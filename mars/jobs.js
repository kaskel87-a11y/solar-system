// v7.5 Mars job loop (Marsmania): TAXI, PARAMEDIC and VIGILANTE side jobs that level up every 5 completions.
// Self-contained add-on: loaded by one <script type="module"> in index.html, talks to the game only through
// window.__app (surface, game, world, toast, state) and window.SSX (registerMenuItem, districtsOf).
// Mirrors the activity-runner pattern from steve/mars-activities (one shared tick, districts by AJ-relative distance)
// without depending on it: we drive our own throttled rAF tick, and export jobsTick(dt, ctx) for a future shared hook.
// Fiction only: invented colony, invented people, no real brands.
import * as THREE from 'three';

/**
 * window.SSX.jobs — public API
 *  types                       -> ['taxi', 'paramedic', 'vigilante']
 *  start(type)                 -> { ok, msg }  start a shift (Mars surface only; vigilante refuses at 2+ wanted stars)
 *  stop(reason?)               -> { ok }       end the current run (no pay, no penalty) and go off duty
 *  active()                    -> null | { type, level, stage, text, timeLeft, pay, dist, target:{x,z} AJ-relative }
 *  level(type)                 -> 1..10   (1 + floor(completions / 5))
 *  stats()                     -> { taxi:{ done, fails, earned, best, level, next }, paramedic:{…}, vigilante:{…}, earned, active }
 *  on(event, fn) | on(fn)      -> unsubscribe fn. Events: 'start' 'stage' 'complete' 'fail' 'stop' 'levelup' 'change'.
 *                                 fn receives { type: event, job, level, pay?, reason?, stage?, ... }
 *  open() / close()            -> show / hide the jobs panel (☰ "💼 Jobs", key J)
 *  places()                    -> { taxiStands, clinics, boards } AJ-relative [x, z]
 *  reportDowned({ x, z, name?, world?:true }) -> queue a downed NPC for the next paramedic call
 *                                 (AJ-relative metres, or world coords with world:true). Same as the window events below.
 *  debug                       -> test helpers: goto() (teleport to the current objective), complete() (finish the run
 *                                 now with normal pay), setDone(type, n), reset(), target() (live target record)
 * Listens (all optional, guarded): window events 'ssx:npc-down' / 'danger:npc-down' / 'danger:down' with detail { x, z, world?, name? },
 * SSX.danger.on('down' | 'npcDown' | 'fight', fn) if CoS's danger.js ever exposes it, and SSX.danger.downed?() -> [{x,z,...}] (world coords).
 * Emits window event 'ssx:job' { detail: same object as on() } for mods that prefer DOM events.
 * Persistence: localStorage 'ssx.jobs.v1' + game flags 'jobs:<type>:L<n>' (saved with the game) when a level is reached.
 */

const KEY = 'ssx.jobs.v1';
const TYPES = ['taxi', 'paramedic', 'vigilante'];
const META = {
  taxi: { icon: '🚕', name: 'Taxi', col: 0xffd400, blurb: 'Pick up fares, drop them in another district. Smooth, fast driving tips well. Crashes and dawdling don\u2019t.' },
  paramedic: { icon: '🚑', name: 'Paramedic', col: 0xff3b3b, blurb: 'Reach downed colonists, stabilise them on foot, then drive them to a clinic before the clock runs out.' },
  vigilante: { icon: '🎯', name: 'Vigilante', col: 0xff3cff, blurb: 'ColSec posts bounties. Track the wanted mark, take them down (shoot, fists or bumper), collect.' }
};
const MAXL = 10, PER = 5;
const DISTRICTS = {
  'ares-junction': { name: 'Ares Junction', centre: [0, 0], r: 70 },
  'red-tape-flats': { name: 'Red Tape Flats', centre: [-280, -40], r: 95 },
  'olympus-row': { name: 'Olympus Row', centre: [0, -430], r: 110 },
  'helios-heights': { name: 'Helios Heights', centre: [320, 80], r: 95 },
  'ares-beltway': { name: 'Ares Beltway', centre: [0, -220], r: 28 }
};
// AJ-relative street points (clear of the Ares Junction buildings; the other districts are open ground until the v7.5 city build)
const POINTS = [
  ['ares-junction', -24, 46], ['ares-junction', 46, 28], ['ares-junction', -58, 6], ['ares-junction', 12, -58], ['ares-junction', 54, -34], ['ares-junction', -12, -62],
  ['red-tape-flats', -250, -10], ['red-tape-flats', -300, -10], ['red-tape-flats', -320, -70], ['red-tape-flats', -240, -80], ['red-tape-flats', -280, 10],
  ['olympus-row', 20, -400], ['olympus-row', -40, -440], ['olympus-row', 30, -470], ['olympus-row', -10, -380], ['olympus-row', 60, -440],
  ['helios-heights', 290, 60], ['helios-heights', 350, 100], ['helios-heights', 320, 40], ['helios-heights', 300, 120],
  ['ares-beltway', -140, 20], ['ares-beltway', 120, 160], ['ares-beltway', -80, -160], ['ares-beltway', 180, -200], ['ares-beltway', 0, -220]
].map(([d, x, z]) => ({ d, at: [x, z] }));
const STANDS = [[-24, 40]];                       // 🚕 taxi stand (Ares Junction, by the supply store)
const CLINICS = [{ name: 'Ares Mercy Clinic', at: [46, 30] }, { name: 'Olympus Trauma Bay', at: [-24, -404] }, { name: 'Heights Med Spa', at: [296, 98] }, { name: 'Flats Free Clinic', at: [-304, -14] }];
const BOARDS = [[-2, -52]];                       // 🎯 ColSec bounty board (behind the security office)
const R_BEACON = 6, R_DROP = 8, R_PICK = 7;
const FARES = ['Moss', 'Dee', 'Quill', 'Hatch', 'Ora', 'Bram', 'Tilly', 'Rook Jr.', 'Sable', 'Inez', 'Corwin', 'Pip'];
const FARE_LINES = ['Olympus Row, and step on it. My shift supervisor eats people.', 'Take the scenic route and I\u2019m not tipping.', 'Drive like you stole it. Did you steal it?', 'Easy on the bumps, I just had dinner.', 'I\u2019m late for my own divorce. Go.'];
const MARKS = [['Gutter Vance', 'armed robbery'], ['Two-Tone Rizzo', 'O2 theft'], ['Mother Kask', 'running a chop shop'], ['Lenny Shiv', 'knifing a guard'], ['The Dentist', 'extortion'], ['Saltblood Kel', 'arson in the Flats'], ['Hollow Jim', 'hijacking a hauler'], ['Vex Marlow', 'airlock tampering']];

// ---------- persistence ----------
let S = load();
function fresh() { const o = { v: 1, earned: 0 }; for (const t of TYPES) o[t] = { done: 0, fails: 0, earned: 0, best: 0 }; return o; }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { for (const t of TYPES) s[t] ||= { done: 0, fails: 0, earned: 0, best: 0 }; return s; } } catch (e) { /* fresh */ } return fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
const levelOf = t => Math.min(MAXL, 1 + Math.floor((S[t]?.done || 0) / PER));

// ---------- plumbing ----------
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game, world = () => surf()?.world;
const toast = (m, ms = 3200) => app()?.toast?.(m, ms);
const subs = new Map(); // event -> Set(fn); '*' = all
function emit(type, extra = {}) {
  const ev = { type, job: run?.type || extra.job || null, level: run ? levelOf(run.type) : null, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('jobs listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:job', { detail: ev })); } catch (e) { /* old browser */ }
  if (type !== 'change') emit('change', { what: type, job: ev.job });
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
function here() { const s = surf(), i = s?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i, cx: i.colony.x, cz: i.colony.z }; }
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function districtAt(x, z) {
  let best = null, bd = 1e9; let reg = []; try { reg = window.SSX?.districtsOf?.('Mars') || []; } catch (e) { reg = []; }
  const all = { ...DISTRICTS }; for (const r of reg) { const c = r.centre || r.center; if (Array.isArray(c) && r.id && !all[r.id]) all[r.id] = { name: r.name || r.id, centre: c, r: r.r || r.radius || 80 }; }
  for (const id in all) { const D = all[id], d = Math.hypot(x - D.centre[0], z - D.centre[1]); if (d < D.r && d / D.r < bd) { bd = d / D.r; best = id; } }
  return best;
}
const dname = id => DISTRICTS[id]?.name || (id ? id.replace(/-/g, ' ') : 'Open desert');
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dirTo = (from, to) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI) + 360) % 360 / 45) % 8];

// ---------- ground height (raycast the surface terrain chunks; fallback: the player's feet) ----------
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
  const s = surf(); if (!s?.scene) return fallback;
  const list = terrainMeshes(s.scene); if (!list.length) return fallback;
  V0.set(wx, 4000, wz); ray.set(V0, DOWN); ray.far = 8000;
  const hit = ray.intersectObjects(list, false)[0]; return hit ? hit.point.y : fallback;
}

// ---------- world presence ----------
let G = null, beacons = [], marker = null, npcs = [];
function labelTex(text, col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.font = 'bold 30px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(250, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(128 - w / 2, 8, w, 48); x.fillStyle = col; x.fillText(text, 128, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const hex = c => '#' + c.toString(16).padStart(6, '0');
function makeBeacon(col, text, r, beamH = 70) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, beamH, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = beamH / 2 - 20; g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, hex(col)), transparent: true, depthWrite: false })); sp.position.y = 3.4; sp.scale.set(3.8, 0.95, 1); g.add(sp);
  g.userData = { ring, sp, text }; return g;
}
function setLabel(g, text, col) { if (g.userData.text === text) return; g.userData.text = text; const m = g.userData.sp.material; m.map?.dispose(); m.map = labelTex(text, hex(col)); m.needsUpdate = true; }
function makePerson(col) { // simple low-poly colonist in a pressure suit
  const g = new THREE.Group(), suit = new THREE.MeshLambertMaterial({ color: col }), dark = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.0, 10), suit); torso.position.y = 1.25; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), suit); head.position.y = 1.98; g.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI), dark); visor.position.set(0, 2.0, -0.12); visor.rotation.y = Math.PI; g.add(visor);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 8), dark); l.position.set(s * 0.15, 0.4, 0); g.add(l); }
  const body = new THREE.Group(); body.add(...g.children.splice(0)); g.add(body); g.userData.body = body; return g;
}
function build(h) {
  const s = surf(); G = new THREE.Group(); G.name = 'mars-jobs'; s.scene.add(G); beacons = []; npcs = []; marker = null;
  const add = (at, kind, col, text, ref) => { const g = makeBeacon(col, text, R_BEACON); g.position.set(h.cx + at[0], h.info.y - 1.7, h.cz + at[1]); G.add(g); beacons.push({ g, at, kind, ref, ground: false }); };
  STANDS.forEach((a, i) => add(a, 'taxi', META.taxi.col, '🚕 TAXI STAND', i));
  CLINICS.forEach((c, i) => add(c.at, 'paramedic', 0xffffff, '✚ ' + c.name.toUpperCase(), i));
  BOARDS.forEach((a, i) => add(a, 'vigilante', META.vigilante.col, '🎯 BOUNTY BOARD', i));
  if (run) syncRunMeshes(h);
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); } G = null; beacons = []; npcs = []; marker = null; if (run) { run.npc = null; } }
function settle(obj, at, h, lift = 0) { // keep a mesh on the ground at AJ-relative `at`
  const wx = h.cx + at[0], wz = h.cz + at[1], y = groundY(wx, wz, null);
  obj.position.set(wx, (y ?? obj.userData.gy ?? (h.info.y - 1.7)) + lift, wz); if (y != null) obj.userData.gy = y;
}

// ---------- runs ----------
let run = null; // { type, stage, t, tMax, ... }
let downedQueue = []; // reported by danger.js / mods: [{ x, z, name }] AJ-relative
function startRun(type) {
  if (!TYPES.includes(type)) return { ok: false, msg: `Unknown job '${type}'.` };
  const h = here(), st = app()?.state;
  if (!h || !st?.onSurface) return { ok: false, msg: 'Jobs run on the Mars surface. Land at Ares Junction first.' };
  if (game()?.isDown?.()) return { ok: false, msg: 'You\u2019re in no shape to work.' };
  if (type === 'vigilante' && (world()?.wanted || 0) >= 2) return { ok: false, msg: '🎯 ColSec won\u2019t deputise somebody with stars on their head. Lose the heat first.' };
  if (run) endRun('stop', { quiet: true });
  const L = levelOf(type);
  run = { type, L, stage: '', t: 0, tMax: 0, started: Date.now(), smooth: 100, crashes: 0, lastSpeed: 0, air: 0, wanted0: world()?.wanted || 0, taps: 0 };
  if (type === 'taxi') newFare(h); else if (type === 'paramedic') newPatient(h); else newMark(h);
  emit('start', { job: type, level: L });
  toast(`${META[type].icon} ${META[type].name} shift started (level ${L}). ${type === 'taxi' && !h.info.driving ? 'Grab any vehicle.' : ''}`, 3000);
  if (G) syncRunMeshes(h);
  return { ok: true, msg: `${META[type].name} started.` };
}
function setStage(stage, t, extra = {}) { run.stage = stage; if (t != null) { run.t = t; run.tMax = t; } Object.assign(run, extra); emit('stage', { stage }); if (G) { const h = here(); if (h) syncRunMeshes(h); } }
function spotNear(h, minD, maxD, notD) {
  const p = [h.x, h.z]; let c = POINTS.filter(q => { const d = dist(q.at, p); return d >= minD && d <= maxD && q.d !== notD; });
  if (!c.length) c = [...POINTS].filter(q => q.d !== notD).sort((a, b) => Math.abs(dist(a.at, p) - (minD + maxD) / 2) - Math.abs(dist(b.at, p) - (minD + maxD) / 2)).slice(0, 3);
  const q = pick(c); const j = () => (Math.random() - 0.5) * 8; return { d: q.d, at: [q.at[0] + j(), q.at[1] + j()] };
}
// TAXI
function newFare(h) {
  const L = run.L, pickup = spotNear(h, 30, 110 + L * 10);
  const minD = Math.min(460, 110 + 40 * (L - 1)), from = pickup.at;
  let c = POINTS.filter(q => q.d !== pickup.d && dist(q.at, from) >= minD);
  if (!c.length) c = POINTS.filter(q => q.d !== pickup.d).sort((a, b) => dist(b.at, from) - dist(a.at, from)).slice(0, 3);
  const drop = pick(c), dd = dist(drop.at, from);
  run.fare = { name: pick(FARES), line: pick(FARE_LINES), from, fromD: pickup.d, to: drop.at, toD: drop.d, dd };
  run.base = Math.round((20 + dd * 0.22) * (1 + 0.2 * (L - 1)));
  run.target = from; run.smooth = 100; run.crashes = 0;
  setStage('pickup', 60 + dist(from, [h.x, h.z]) / 6, { text: `Pick up ${run.fare.name}` });
}
// PARAMEDIC
function newPatient(h) {
  const L = run.L; let at = null, src = 'spawn', name = pick(FARES);
  while (downedQueue.length && !at) { const q = downedQueue.shift(); if (Date.now() - q.t < 120000 && dist([q.x, q.z], [h.x, h.z]) < 400) { at = [q.x, q.z]; src = q.src || 'event'; name = q.name || name; } }
  if (!at) { try { const L2 = window.SSX?.danger?.downed?.(); if (Array.isArray(L2) && L2.length) { const d = L2[0]; at = [d.x - h.cx, d.z - h.cz]; src = 'danger'; name = d.name || name; } } catch (e) { /* optional */ } }
  if (!at) at = spotNear(h, 40 + L * 12, 120 + L * 25).at;
  const d0 = dist(at, [h.x, h.z]);
  run.patient = { name, at, src, need: 3 + Math.floor(L / 2), why: pick(['took a knife in a street fight', 'fell off a hab roof', 'got clipped by a hauler', 'O2 line failure', 'bar fight gone bad', 'dust-lung attack']) };
  run.target = at; run.taps = 0;
  run.base = Math.round((40 + d0 * 0.15) * (1 + 0.2 * (L - 1)));
  setStage('reach', Math.max(35, 40 + d0 / 7 - L * 3), { text: `Reach ${name}` });
}
function nearestClinic(p) { return [...CLINICS].sort((a, b) => dist(a.at, p) - dist(b.at, p))[0]; }
// VIGILANTE
function newMark(h) {
  const L = run.L, sp = spotNear(h, 60 + L * 10, 150 + L * 30), [name, crime] = pick(MARKS);
  run.mark = { name, crime, at: [...sp.at], hp: 3 + L, maxHp: 3 + L, armed: L >= 3, flee: false, cd: 1.5, speed: 3.6 + 0.35 * L, down: false, home: sp.d };
  run.target = run.mark.at; run.base = Math.round((70 + 20 * L) * (1 + 0.1 * (L - 1)));
  setStage('hunt', Math.max(70, 160 - 9 * L), { text: `Find ${name}` });
}
function hitMark(dmg, how) {
  const m = run?.type === 'vigilante' ? run.mark : null; if (!m || m.down) return false;
  m.hp -= dmg; m.flee = true; m.hitT = 0.25;
  if (m.hp <= 0) { m.down = true; m.how = how; setStage('down', null, { text: `${m.name} is down` }); setTimeout(() => { if (run?.mark === m) complete(); }, 600); }
  return true;
}

function complete(opts = {}) {
  if (!run) return null;
  const h = here(), type = run.type, L = run.L; let pay = run.base || 30, tip = 0, xp = 20 + 6 * L, note = '';
  if (type === 'taxi') { const frac = run.tMax ? Math.max(0, run.t / run.tMax) : 0.5, over = Math.max(0, -run.t);
    pay = Math.max(5, Math.round(run.base * (over ? Math.max(0.3, 1 - over / 40) : 1)));
    tip = over ? 0 : Math.round(run.base * (0.3 + 0.05 * L) * frac * Math.max(0, run.smooth) / 100);
    note = `${run.fare.name}: ${run.crashes ? `${run.crashes} crash${run.crashes > 1 ? 'es' : ''}` : 'smooth ride'}${tip ? `, +${tip} tip` : over ? ', late, no tip' : ''}.`; }
  else if (type === 'paramedic') { const frac = run.tMax ? Math.max(0, run.t / run.tMax) : 0.5; tip = Math.round(run.base * 0.5 * frac); note = `${run.patient.name} made it to ${run.clinic?.name || 'the clinic'}${tip ? `, +${tip} speed bonus` : ''}.`; }
  else { const coll = Math.max(0, (world()?.wanted || 0) - run.wanted0); const frac = run.tMax ? Math.max(0, run.t / run.tMax) : 0.5; tip = Math.round(run.base * 0.4 * frac);
    if (coll) { pay = Math.round(pay * 0.6); note = ' Collateral cut your bounty.'; } else { const w = world(); if (w?.wanted > 0) w.setWanted?.(w.wanted - 1, 'bounty paid'); }
    note = `${run.mark.name} (${run.mark.crime}) taken down${tip ? `, +${tip} quick-work bonus` : ''}.${note}`; }
  const total = pay + tip;
  try { game()?.reward?.(xp, total); } catch (e) { console.warn('jobs reward', e); }
  const before = levelOf(type); S[type].done++; S[type].earned += total; S[type].best = Math.max(S[type].best, total); S.earned += total; save();
  const after = levelOf(type);
  emit('complete', { job: type, level: before, pay: total, base: pay, tip, xp, note });
  toast(`${META[type].icon} +${total} cr. ${note}`, 3800);
  if (after > before) { try { game()?.setFlag?.(`jobs:${type}:L${after}`); } catch (e) { /* optional */ } emit('levelup', { job: type, level: after }); setTimeout(() => toast(`⬆️ ${META[type].name} level ${after}! Better pay, harder runs.`, 3600), 1800); }
  // keep the shift going: next fare / call / bounty
  const keep = opts.keep !== false; run.L = after;
  if (keep && h) { clearRunNpc(); run.smooth = 100; run.crashes = 0; run.wanted0 = world()?.wanted || 0; if (type === 'taxi') newFare(h); else if (type === 'paramedic') newPatient(h); else newMark(h); }
  else endRun('stop', { quiet: true });
  return { pay: total, level: after };
}
function fail(reason) {
  if (!run) return; const type = run.type; S[type].fails++; save();
  emit('fail', { job: type, reason }); toast(`${META[type].icon} ${reason}`, 3400);
  const h = here(); clearRunNpc();
  if (h && !game()?.isDown?.()) { run.smooth = 100; run.crashes = 0; if (type === 'taxi') newFare(h); else if (type === 'paramedic') newPatient(h); else newMark(h); }
  else endRun('stop', { quiet: true });
}
function endRun(why = 'stop', o = {}) {
  if (!run) return { ok: false }; const type = run.type; clearRunNpc(); run = null; if (marker) { marker.parent?.remove(marker); marker = null; }
  emit('stop', { job: type, reason: why }); if (!o.quiet) toast(`${META[type].icon} Off duty.`, 2000); renderHud(); return { ok: true };
}
function clearRunNpc() { if (run?.npc) { run.npc.parent?.remove(run.npc); run.npc = null; } }
function syncRunMeshes(h) { // npc + objective marker for the current stage
  if (!G || !run) return;
  const col = META[run.type].col;
  if (!marker) { marker = makeBeacon(col, '', R_DROP, 120); G.add(marker); }
  marker.userData.ring.material.color.setHex(col); marker.children[0].material.color.setHex(col);
  let label = '';
  if (run.type === 'taxi') label = run.stage === 'pickup' ? '🚕 FARE' : '🏁 DROP-OFF';
  else if (run.type === 'paramedic') label = run.stage === 'transport' ? '✚ CLINIC' : '🩺 PATIENT';
  else label = '🎯 ' + run.mark.name.toUpperCase();
  setLabel(marker, label, col);
  const wantNpc = (run.type === 'taxi' && run.stage === 'pickup') || (run.type === 'paramedic' && run.stage !== 'transport') || run.type === 'vigilante';
  if (wantNpc && !run.npc) { run.npc = makePerson(run.type === 'vigilante' ? 0x7a1f7a : run.type === 'paramedic' ? 0xd8d8d8 : 0xe0a030); G.add(run.npc); run.npc.userData.at = null; }
  if (!wantNpc) clearRunNpc();
}

// ---------- danger.js / mod hooks (guarded) ----------
function reportDowned(d) {
  const h = here(); if (!d || typeof d.x !== 'number' || typeof d.z !== 'number') return false;
  const x = d.world && h ? d.x - h.cx : d.x, z = d.world && h ? d.z - h.cz : d.z;
  downedQueue.push({ x, z, name: d.name || null, src: d.src || 'event', t: Date.now() }); downedQueue = downedQueue.slice(-6); return true;
}
for (const ev of ['ssx:npc-down', 'danger:npc-down', 'danger:down']) window.addEventListener(ev, e => { try { const d = e.detail || {}; reportDowned({ world: d.world !== false && d.aj !== true, ...d, src: ev }); } catch (x) { /* ignore */ } });
let dangerHooked = false;
function hookDanger() {
  const D = window.SSX?.danger; if (dangerHooked || !D || typeof D.on !== 'function') return; dangerHooked = true;
  for (const k of ['down', 'npcDown', 'fight']) { try { D.on(k, e => { const n = e?.npc || e?.b || e; if (n && typeof n.x === 'number') reportDowned({ x: n.x, z: n.z, world: true, name: n.name, src: 'danger:' + k }); }); } catch (e) { /* not supported */ } }
}

// ---------- world patch: make the vigilante mark hittable (mirrors CoS dangerhooks.patchWorld; chains, never replaces) ----------
const patched = new WeakSet();
function markWorld(h) { const m = run?.type === 'vigilante' && run.mark && !run.mark.down ? run.mark : null; if (!m || !h) return null; return { x: h.cx + m.at[0], z: h.cz + m.at[1], y: (run.npc?.position.y ?? h.info.y - 1.7) + 1.2 }; }
function patchWorld(w) {
  if (!w || patched.has(w)) return; patched.add(w);
  const oHit = w.hitWorld, oT = w.targets, oMT = w.meleeTarget, oMW = w.meleeWorld, oShot = w.shotFired, oBlast = w.blast;
  const segD = (p0, p1, c) => { const sx = p1.x - p0.x, sy = p1.y - p0.y, sz = p1.z - p0.z, L2 = sx * sx + sy * sy + sz * sz; const t = L2 ? Math.max(0, Math.min(1, ((c.x - p0.x) * sx + (c.y - p0.y) * sy + (c.z - p0.z) * sz) / L2)) : 0; return Math.hypot(p0.x + sx * t - c.x, p0.y + sy * t - c.y, p0.z + sz * t - c.z); };
  if (oHit) w.hitWorld = (p0, p1, b) => { const c = markWorld(here()); if (c && segD(p0, p1, c) < 0.8) { hitMark(b?.dmg || 1, 'shot'); return true; } return oHit(p0, p1, b); };
  if (oT) w.targets = () => { const out = oT(); const c = markWorld(here()); if (c) out.push({ x: c.x, y: c.y, z: c.z, kind: 'bounty' }); return out; };
  if (oMT) w.meleeTarget = (x, z, yaw, range) => { const r = oMT(x, z, yaw, range), c = markWorld(here()); if (c) { const d = Math.hypot(c.x - x, c.z - z); if (d < range && (!r || d < Math.hypot(r.x - x, r.z - z))) return { x: c.x, z: c.z, kind: 'bounty' }; } return r; };
  if (oMW) w.meleeWorld = (x, z, fx, fz, range, dmg, knock) => { const c = markWorld(here()); if (c) { const dx = c.x - x, dz = c.z - z; if (Math.hypot(dx, dz) < range + 0.6 && dx * fx + dz * fz > -0.3) { hitMark(dmg || 1, 'melee'); return true; } } return oMW(x, z, fx, fz, range, dmg, knock); };
  if (oBlast) w.blast = (c0, R, dmg, emp) => { const c = markWorld(here()); let n = 0; if (c && Math.hypot(c.x - c0.x, c.z - c0.z) < R) { hitMark(emp ? 0.5 : dmg, 'blast'); n = 1; } return n + oBlast(c0, R, dmg, emp); };
  // a bounty is sanctioned: shots fired near the live mark aren't "discharging a weapon in the colony"
  if (oShot) w.shotFired = (...a) => { const h = here(), c = markWorld(h); if (c && h && Math.hypot(c.x - h.info.x, c.z - h.info.z) < 45) return; return oShot(...a); };
}

// ---------- tick ----------
let lastT = performance.now(), lastFrame = 0;
function loop() { requestAnimationFrame(loop); const now = performance.now(); if (now - lastFrame < 100) return; const dt = Math.min(0.5, (now - lastT) / 1000); lastT = now; lastFrame = now; try { jobsTick(dt); } catch (e) { console.warn('jobs tick', e); } }
export function jobsTick(dt /* , ctx — accepted for the shared activity-runner hook, unused */) {
  hookDanger();
  const st = app()?.state, h = here(), s = surf();
  if (!h || !st?.onSurface || st.transitioning) { if (G && (!s || G.parent !== s.scene || !h)) teardown(); if (run && !st?.transitioning && (!st?.onSurface || !h)) endRun('left'); setNear(null); renderHud(); return; }
  patchWorld(s.world);
  if (!G || G.parent !== s.scene) { teardown(); build(h); }
  const i = h.info, now = performance.now(), slow = !i.driving || Math.abs(i.speed) < 4;
  let nb = null;
  for (const b of beacons) {
    const d = Math.hypot(h.x - b.at[0], h.z - b.at[1]);
    if (!b.ground && d < 160) { const y = groundY(h.cx + b.at[0], h.cz + b.at[1], null); if (y != null) { b.g.position.y = y; b.ground = true; } }
    b.g.userData.ring.material.opacity = 0.35 + 0.25 * Math.sin(now / 300);
    if (!i.inside && slow && d < R_BEACON && (!nb || d < nb.d)) nb = { d, kind: b.kind, ref: b.ref };
  }
  setNear(nb);
  if (run) stepRun(dt, h); else renderHud();
}
function stepRun(dt, h) {
  const i = h.info, p = [h.x, h.z], r = run, L = r.L;
  if (game()?.isDown?.()) { fail(r.type === 'paramedic' ? 'You went down. Dispatch sent someone else.' : 'You went down. Shift over.'); endRun('down', { quiet: true }); return; }
  r.t -= dt;
  // smooth-driving meter (taxi): a sudden speed loss is a crash, big air scares the fare
  const sp = Math.abs(i.speed || 0);
  if (i.driving) { if (r.lastSpeed > 8 && r.lastSpeed - sp > 6) { r.crashes++; r.smooth -= 22; r.crashT = 1.5; if (r.type === 'taxi' && r.stage === 'drop') toast(pick(['😖 “Are you TRYING to kill me?”', '😖 “My spine! I\u2019m docking your tip.”', '😖 “Eyes on the road!”']), 1800); }
    if (i.air) { r.air += dt; if (r.air > 0.8 && !r.airHit) { r.airHit = true; r.smooth -= 8; } } else { r.air = 0; r.airHit = false; } }
  r.lastSpeed = i.driving ? sp : 0;
  const npc = r.npc;
  if (r.type === 'taxi') {
    if (r.stage === 'pickup') {
      r.target = r.fare.from; r.text = i.driving ? `Pick up ${r.fare.name}` : 'Get in any vehicle';
      if (npc) { settle(npc, r.fare.from, h); npc.rotation.y = Math.atan2(h.x - r.fare.from[0], h.z - r.fare.from[1]); }
      if (i.driving && dist(p, r.fare.from) < R_PICK && sp < 5) { const dd = r.fare.dd; toast(`🚕 ${r.fare.name}: “${r.fare.line}” → ${dname(r.fare.toD)}`, 3400); setStage('drop', Math.max(25, dd / (9 + 1.1 * L) + 22 - L), { text: `Drop ${r.fare.name} in ${dname(r.fare.toD)}`, target: r.fare.to }); r.smooth = 100; r.crashes = 0; }
      else if (r.t <= 0) fail(`${r.fare.name} got tired of waiting and walked.`);
    } else if (r.stage === 'drop') {
      r.target = r.fare.to;
      if (!i.driving) { r.offFoot = (r.offFoot || 0) + dt; r.text = `Get back in! ${r.fare.name} is leaving`; if (r.offFoot > 8) { fail(`${r.fare.name} bailed on your ride. No fare.`); return; } } else r.offFoot = 0;
      if (i.driving && dist(p, r.fare.to) < R_DROP && sp < 6) { complete(); return; }
      if (r.t < -40) fail(`${r.fare.name} jumped out at a red light. No fare.`);
    }
  } else if (r.type === 'paramedic') {
    const P = r.patient;
    if (npc && r.stage !== 'transport') { settle(npc, P.at, h, 0.05); const b = npc.userData.body; b.rotation.x = -Math.PI / 2; b.position.y = 0.3; }
    if (r.stage === 'reach') {
      r.target = P.at; r.text = `Reach ${P.name} (${P.why})`;
      if (dist(p, P.at) < 12) setStage('stabilise', null, { text: 'Stabilise' });
      else if (r.t <= 0) fail(`${P.name} didn\u2019t make it. Dispatch is not impressed.`);
    } else if (r.stage === 'stabilise') {
      r.target = P.at; const d = dist(p, P.at);
      r.text = i.driving ? `Get out and stabilise ${P.name}` : d > 3.5 ? `Walk to ${P.name}` : `Stabilise ${P.name}: ${r.taps}/${P.need}`;
      if (r.t <= 0) fail(`${P.name} didn\u2019t make it. Dispatch is not impressed.`);
    } else if (r.stage === 'load') {
      r.target = P.at; r.text = i.driving ? `Pull up next to ${P.name}` : `Get in a vehicle to carry ${P.name}`;
      if (i.driving && dist(p, P.at) < 25) { const c = nearestClinic(p), d0 = dist(p, c.at); r.clinic = c; toast(`🚑 ${P.name} is loaded. Go to ${c.name}!`, 2600); setStage('transport', Math.max(30, d0 / (8 + 0.8 * L) + 30 - 2 * L), { text: `Drive to ${c.name}`, target: c.at }); }
      else if (r.t <= 0) fail(`${P.name} didn\u2019t make it. Dispatch is not impressed.`);
    } else if (r.stage === 'transport') {
      r.target = r.clinic.at; r.text = `Drive to ${r.clinic.name}`;
      if (!i.driving) { const c = nearestClinic(p); if (dist(p, c.at) < R_DROP) { r.clinic = c; complete(); return; } r.text = `Carry on: ${r.clinic.name}`; }
      if (dist(p, r.clinic.at) < R_DROP && sp < 7) { complete(); return; }
      if (r.t <= 0) fail(`${P.name} flatlined in your back seat. Rough night.`);
    }
  } else { // vigilante
    const m = r.mark; if (m.down) { r.text = `${m.name} is down`; return; }
    const d = dist(p, m.at);
    if (r.stage === 'hunt' && d < 40) setStage('takedown', null, { text: `Take down ${m.name}` });
    if (d < 30) m.flee = true;
    if (m.flee) { // run away from the player, faster on higher levels; slows a bit when hurt
      const ax = m.at[0] - p[0], az = m.at[1] - p[1], L2 = Math.hypot(ax, az) || 1, v = m.speed * (m.hitT > 0 ? 0.3 : 1) * dt;
      m.at[0] += ax / L2 * v + Math.sin(performance.now() / 700) * 0.4 * dt * m.speed; m.at[1] += az / L2 * v; m.hitT = Math.max(0, (m.hitT || 0) - dt);
      if (Math.hypot(m.at[0], m.at[1]) > 600) { m.at[0] *= 0.99; m.at[1] *= 0.99; }
    }
    if (npc) { settle(npc, m.at, h); npc.rotation.y = Math.atan2(m.at[0] - p[0], m.at[1] - p[1]) + Math.PI; }
    // armed marks shoot back
    m.cd -= dt; if (m.armed && d < 18 && m.cd <= 0) { m.cd = Math.max(0.9, 2.2 - 0.12 * L); if (Math.random() < 0.55) { try { game()?.hurtPlayer?.(3 + L, { x: h.cx + m.at[0], z: h.cz + m.at[1] }); } catch (e) { /* ignore */ } } }
    // run them over
    if (i.driving && d < 3 && sp > 7) { hitMark(2 + sp / 6, 'vehicle'); }
    r.target = m.at; r.text = r.stage === 'hunt' ? `Find ${m.name} (${m.crime})` : `Take down ${m.name}: ${Math.max(0, Math.ceil(m.hp))}/${m.maxHp} HP`;
    if (r.t <= 0) fail(`${m.name} slipped into the dust. Bounty expired.`);
  }
  if (run && marker && run.target) { settle(marker, run.target, h); marker.userData.ring.material.opacity = 0.4 + 0.3 * Math.sin(performance.now() / 250); }
  renderHud();
}
function actStabilise() {
  const h = here(); if (!run || run.type !== 'paramedic' || run.stage !== 'stabilise' || !h) return false;
  if (h.info.driving || dist([h.x, h.z], run.patient.at) > 3.5) { toast('🩺 Get out and kneel next to the patient.', 1800); return false; }
  run.taps++; emit('stage', { stage: 'stabilise', taps: run.taps });
  if (run.taps >= run.patient.need) { toast(`🩺 ${run.patient.name} is stable. Get them in a vehicle.`, 2400); setStage('load', Math.max(25, 40 - 2 * run.L), { text: 'Load patient' }); }
  renderHud(); return true;
}

// ---------- UI (high contrast: black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#jobHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(60px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif;pointer-events:auto}
@media (max-width:640px){#jobHud{top:calc(158px + env(safe-area-inset-top));width:calc(100vw - 16px)} #jobHud .tx{flex:1}} /* below the minimap on phones */
body.surface #jobHud.show{display:flex} #jobHud .tx{min-width:0} #jobHud .l1{font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #jobHud .l2{font-weight:600;opacity:.95;white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #jobHud .warn{color:#ffd400}
#jobHud button,#jobAct{min-height:44px;min-width:64px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;flex:none}
#jobAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:34%;display:none;min-height:52px;min-width:130px} body.surface #jobAct.show{display:block} body.indoors #jobAct{display:none!important}
#jobPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #jobPanel.show{display:flex}
#jobPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#jobBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #jobPanel .msg,#jobPanel .foot{flex:none}
#jobPanel h2{margin:0 0 2px;font-size:18px} #jobPanel .sub{margin:0 0 8px;font-size:13px;opacity:.85}
#jobPanel .it{padding:10px 0;border-top:1px solid rgba(255,255,255,.3)} #jobPanel .it b{font-size:15px} #jobPanel .it small{display:block;font-size:12px;opacity:.85;margin-top:2px}
#jobPanel .bar{height:8px;border:1px solid #fff;border-radius:4px;margin:6px 0;overflow:hidden} #jobPanel .bar i{display:block;height:100%;background:#fff}
#jobPanel button{width:100%;min-height:46px;margin-top:6px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation} #jobPanel button.on{background:#fff;color:#000}
#jobPanel .msg{min-height:1.2em;margin:8px 0;font-weight:700} #jobPanel .foot{display:flex;gap:8px}
`;
let hud, hudTx, hudStop, actBtn, panel, body, msgEl, near = null, lastMsg = '', lastTouchAct = 0, hudKey = '';
// window.__onTap (iOS-safe pointer binding from index.html). Re-rendered panels swallow the ghost click for 700 ms.
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'jobHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="jobStop" type="button" aria-label="Stop job">Stop</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; hudStop = hud.querySelector('#jobStop');
  tap(hudStop, () => endRun('stop'));
  tap(hud.querySelector('.tx'), () => open());
  actBtn = document.createElement('button'); actBtn.id = 'jobAct'; actBtn.type = 'button'; document.body.appendChild(actBtn);
  tap(actBtn, () => doAction());
  panel = document.createElement('div'); panel.id = 'jobPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Jobs"><div id="jobBody"></div><div class="msg" id="jobMsg"></div><div class="foot"><button id="jobClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#jobBody'); msgEl = panel.querySelector('#jobMsg');
  tap(panel.querySelector('#jobClose'), close);
  addEventListener('keydown', e => {
    if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !app()?.state?.onSurface) return;
    if (e.code === 'KeyJ') { panel.classList.contains('show') ? close() : open(); }
    else if (e.code === 'KeyG' && actBtn.classList.contains('show')) { e.preventDefault(); doAction(); }
  });
}
function actionFor() {
  const h = here(); if (!h) return null; const i = h.info;
  if (run?.type === 'paramedic' && run.stage === 'stabilise' && !i.driving && dist([h.x, h.z], run.patient.at) < 3.5) return { id: 'stab', label: `🩺 Stabilise ${run.taps}/${run.patient.need}` };
  if (near) { const t = near.kind; return run?.type === t ? { id: 'stop', label: `${META[t].icon} Stop ${META[t].name}` } : { id: 'start:' + t, label: `${META[t].icon} Start ${META[t].name}` }; }
  if (i.driving && !run) return { id: 'start:taxi', label: '🚕 Taxi duty' }; // vehicle toggle
  if (i.driving && run?.type === 'taxi') return null; // HUD has Stop
  return null;
}
function doAction() {
  const a = actionFor(); if (!a) return;
  if (a.id === 'stab') actStabilise();
  else if (a.id === 'stop') endRun('stop');
  else { const r = startRun(a.id.slice(6)); if (!r.ok) toast(r.msg, 2600); }
  refreshAct(true);
}
let actKey = '';
function refreshAct(force) { if (!actBtn) return; const a = actionFor(), k = a ? a.id + a.label : ''; if (!force && k === actKey) return; actKey = k; actBtn.textContent = a ? a.label + (isTouch() ? '' : ' (G)') : ''; actBtn.classList.toggle('show', !!a); }
function setNear(nb) { near = nb; refreshAct(); }
function renderHud() {
  if (!hud) return; refreshAct();
  if (!run) { if (hud.classList.contains('show')) { hud.classList.remove('show'); hudKey = ''; } if (panel?.classList.contains('show')) renderPanelThrottled(); return; }
  const h = here(), M = META[run.type], d = h && run.target ? Math.round(dist([h.x, h.z], run.target)) : null;
  const pay = run.base || 0, warn = run.t < 10;
  const l1 = `${M.icon} ${M.name.toUpperCase()} · L${run.L} · ⏱ ${run.t < 0 ? '+' + fmtT(-run.t) : fmtT(run.t)} · 💰 ${pay} cr${run.type === 'taxi' && run.stage === 'drop' ? ` · ${Math.max(0, Math.round(run.smooth))}% smooth` : ''}`;
  const l2 = `${run.text || ''}${d != null && h ? ` · ${d} m ${dirTo([h.x, h.z], run.target)}` : ''}`;
  const k = l1 + '|' + l2 + warn;
  if (k !== hudKey) { hudKey = k; hudTx[0].textContent = l1; hudTx[1].textContent = l2; hudTx[0].classList.toggle('warn', warn); }
  hud.classList.add('show');
  if (panel?.classList.contains('show')) renderPanelThrottled();
}
let panelT = 0; function renderPanelThrottled() { const n = performance.now(); if (n - panelT > 1000) { panelT = n; render(); } }
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const h = here(); let html = `<h2>💼 Mars jobs</h2><p class="sub">${h ? `${dname(districtAt(h.x, h.z))} · ` : 'Land on Mars to work. '}Every ${PER} completions = next level (more pay, harder runs). Total earned: ${S.earned} cr.</p>`;
  for (const t of TYPES) {
    const M = META[t], L = levelOf(t), done = S[t].done, into = L >= MAXL ? PER : done % PER, act = run?.type === t;
    html += `<div class="it"><b>${M.icon} ${M.name} · Level ${L}${L >= MAXL ? ' (max)' : ''}</b><small>${esc(M.blurb)}</small><div class="bar"><i style="width:${into / PER * 100}%"></i></div><small>${done} done · ${S[t].fails} failed · ${S[t].earned} cr earned${L < MAXL ? ` · ${PER - into} to level ${L + 1}` : ''}</small>${act ? `<small>On shift: ${esc(run.text || '')}</small>` : ''}<button type="button" data-job="${t}" class="${act ? 'on' : ''}">${act ? 'Stop' : 'Start'} ${M.name}</button></div>`;
  }
  html += `<p class="sub" style="margin-top:8px">Find them in town: 🚕 taxi stand by Ares Supply, ✚ clinics in every district, 🎯 bounty board behind Colony Security. In any vehicle: “🚕 Taxi duty”. Keys: J jobs, G action.</p>`;
  body.innerHTML = html; msgEl.textContent = lastMsg;
  body.querySelectorAll('button[data-job]').forEach(b => tap(b, () => { const t = b.dataset.job; if (run?.type === t) { endRun('stop'); lastMsg = 'Off duty.'; } else { const r = startRun(t); lastMsg = r.msg; if (r.ok) { close(); return; } } render(); }));
}

// ---------- boot ----------
const API = {
  types: [...TYPES],
  start: type => startRun(String(type || '').toLowerCase()),
  stop: reason => endRun(reason || 'stop'),
  active: () => run ? { type: run.type, level: run.L, stage: run.stage, text: run.text || '', timeLeft: Math.round(run.t * 10) / 10, pay: run.base || 0, smooth: run.type === 'taxi' ? Math.round(run.smooth) : undefined, dist: (() => { const h = here(); return h && run.target ? Math.round(dist([h.x, h.z], run.target)) : null; })(), target: run.target ? { x: run.target[0], z: run.target[1] } : null } : null,
  level: type => TYPES.includes(type) ? levelOf(type) : null,
  stats: () => { const o = { earned: S.earned, active: run ? run.type : null }; for (const t of TYPES) { const L = levelOf(t); o[t] = { ...S[t], level: L, next: L >= MAXL ? null : PER - (S[t].done % PER) }; } return o; },
  on, open, close, reportDowned, stabilise: actStabilise,
  places: () => ({ taxiStands: STANDS.map(a => [...a]), clinics: CLINICS.map(c => ({ name: c.name, at: [...c.at] })), boards: BOARDS.map(a => [...a]) }),
  debug: {
    goto() { const h = here(), s = surf(); if (!run || !h || !run.target) return false; const t = run.target; s.debugMove(h.cx + t[0] + (run.type === 'vigilante' ? 4 : 1.5), h.cz + t[1] + 1.5, 0); return true; },
    complete() { if (!run) return null; if (run.type === 'paramedic' && !run.clinic) run.clinic = nearestClinic(run.patient.at); return complete(); },
    setDone(type, n) { if (!S[type]) return false; S[type].done = Math.max(0, n | 0); save(); emit('change', { what: 'debug' }); return levelOf(type); },
    reset() { if (run) endRun('stop', { quiet: true }); S = fresh(); save(); emit('change', { what: 'reset' }); },
    target: () => run ? JSON.parse(JSON.stringify({ type: run.type, stage: run.stage, t: run.t, target: run.target, fare: run.fare, patient: run.patient, mark: run.mark, clinic: run.clinic })) : null,
    hit: dmg => hitMark(dmg || 99, 'debug')
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.jobs = API; ui();
  try { window.SSX.registerMenuItem({ id: 'rmJobs', label: '💼 Jobs', onTap: () => open() }); } catch (e) { console.warn('jobs menu', e); }
  requestAnimationFrame(loop);
})();
