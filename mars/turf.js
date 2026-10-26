// v7.5 Mars gang turf wars (Marsmania): Red Tape Flats split into six blocks held by Saltblood and two rival crews.
// Attack a block, survive its defenders' waves, and it's yours: owned blocks pay passive income and draw counter-attacks
// from the gang that lost them. Self-contained add-on loaded by one <script type="module"> in index.html. It talks to the
// game only through window.__app (surface, game, world, toast, state) and window.SSX (registerMenuItem, on/emit, city).
// Integrations are all feature-detected: SSX.raids (Steve's wave engine), SSX.gang (a crew spawner, if one ever ships),
// SSX.danger, SSX.contraband. With none of them present it spawns through the core SSX.city.hostiles / game.hostiles.
// Fiction only: invented colony, invented gangs, no real brands.
import * as THREE from 'three';

/**
 * window.SSX.turf — public API (positions are AJ-relative metres [x, z] unless noted)
 *  blocks()                    -> [{ id, name, owner, ownerName, income, tier, flag:[x,z], r, status, lostBy, locked }]
 *  owner(blockId)              -> 'saltblood' | 'dustjaws' | 'saints' | 'player' | null
 *  ownerAt(pos?)               -> null | { block, owner, ownerName }   pos {x,z} | [x,z] AJ-relative (default: the player)
 *  attack(blockId, opts?)      -> { ok, msg }  start a takeover (be on the block; opts.force skips the distance check)
 *  retreat()                   -> { ok }      give up the current fight (counts as a loss)
 *  income()                    -> { perMin, pending, earned, blocks }  passive income from blocks you hold
 *  fight()                     -> null | { kind:'take'|'defend', block, gang, wave, waves, alive, phase, timeLeft, engine }
 *  priceMultiplier(district?, pos?) -> 1 on rival turf / elsewhere, 1.25 (+0.05 per extra block, max 1.5) on your turf
 *  gangs                       -> { saltblood:{ name, col, blurb }, dustjaws:{…}, saints:{…} }
 *  on(event, fn) | on(fn)      -> unsubscribe. Events: 'attack' 'wave' 'captured' 'failed' 'income' 'counter'
 *                                 'defended' 'lost' 'change'. fn gets { type, block, gang, ... }.
 *  open() / close()            -> the turf panel (☰ "🚩 Turf", key K, the 🗺️ TURF MAP beacon in the Flats)
 *  debug                       -> goto(id), clearWave(), counter(id?), arrive(), tickIncome(sec), setOwner(id, owner),
 *                                 reset(), state(), engine()
 * Also emits window event 'ssx:turf' and SSX.emit('turf:<event>') on the core bus.
 * Persistence: localStorage 'ssx.turf.v1' + game flag 'turf:first' (saved with the game) on the first takeover.
 */

const KEY = 'ssx.turf.v1';
const FLATS = 'mars-rough', FLATS_AJ = [-280, -40]; // Red Tape Flats origin, AJ-relative (citydata DISTRICT_DATA.rough)
const GANGS = {
  saltblood: { name: 'Saltblood', col: 0xe0282e, types: ['thug', 'goon', 'enforcer'], blurb: 'Red tape on both arms. Runs the Flats for the Quiet. Doesn\u2019t forget.' },
  dustjaws: { name: 'Dustjaw Boys', col: 0xffa020, types: ['thug', 'thug', 'goon'], blurb: 'Scrap-strippers in welded respirator jaws. Loud, many, cheap.' },
  saints: { name: 'Vacuum Saints', col: 0xb07cff, types: ['goon', 'enforcer'], blurb: 'Funeral-bar cult. Says it \u201csends you to orbit\u201d. Means it.' },
  player: { name: 'You', col: 0x3cff8a }
};
// Blocks: local coords inside Red Tape Flats (origin above). flag = rally point / beacon, clear of the citydata buildings
// and the reserved 'flats-dealer' lot at [36,-34]. Voronoi by nearest centre decides which block a point is in.
const BLOCKS = [
  { id: 'chop-row', name: 'Chop Row', c: [-26, 24], flag: [-34, 32], tier: 2, income: 10, gang: 'saltblood', note: 'Wrench\u2019s chop lot and the parts alley.' },
  { id: 'blues-den', name: 'Blue\u2019s Den', c: [28, -12], flag: [44, -10], tier: 2, income: 12, gang: 'saltblood', note: 'The no-name dealer den. Glow-dust money.' },
  { id: 'marrow-court', name: 'Marrow\u2019s Court', c: [0, -8], flag: [-6, -30], tier: 3, income: 16, gang: 'saltblood', hq: true, note: 'Saltblood HQ under the big dome. Hold two blocks first.' },
  { id: 'funeral-mile', name: 'Funeral Mile', c: [14, 34], flag: [24, 42], tier: 1, income: 8, gang: 'saints', note: 'Ashes to Orbit and the closed stalls.' },
  { id: 'hab-stacks', name: 'Hab Stacks', c: [-38, -24], flag: [-52, -32], tier: 1, income: 7, gang: 'dustjaws', note: 'Stacked habs round the west dome.' },
  { id: 'tag-tower', name: 'Tag Tower', c: [-48, 6], flag: [-60, 4], tier: 2, income: 9, gang: 'dustjaws', note: 'The water tower, tagged top to bottom.' }
];
const R_FLAG = 6, R_ZONE = 34, FLATS_R = 92;
const MAP_AT = [-8, 16]; // 🗺️ turf map beacon (local), near the fast-travel point
const PAY_EVERY = 30, OFFLINE_CAP_MIN = 240, ALERT_T = 90, LEASH_T = 12;
const COUNTER_MIN = 240, COUNTER_MAX = 480;

// ---------- persistence ----------
let S = load();
function fresh() { const o = { v: 1, owners: {}, lostBy: {}, purse: 0, earned: 0, lastAt: Date.now(), taken: 0, defended: 0, lost: 0, track: null }; for (const b of BLOCKS) o.owners[b.id] = b.gang; return o; }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1 && s.owners) { for (const b of BLOCKS) if (!GANGS[s.owners[b.id]]) s.owners[b.id] = b.gang; s.lostBy ||= {}; return { ...fresh(), ...s }; } } catch (e) { /* fresh */ } return fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };

// ---------- plumbing ----------
const app = () => window.__app, surf = () => app()?.surface, game = () => app()?.game || surf()?.game;
const toast = (m, ms = 3200) => app()?.toast?.(m, ms);
const radio = (text, contact) => { try { if (window.SSX?.city?.radio) return window.SSX.city.radio(text, contact); } catch (e) { /* fall through */ } toast(`📻 ${contact}: ${text}`, 4200); };
const subs = new Map();
function emit(type, extra = {}) {
  const ev = { type, ...extra };
  for (const k of [type, '*']) for (const f of subs.get(k) || []) { try { f(ev); } catch (e) { console.warn('turf listener', e); } }
  try { window.dispatchEvent(new CustomEvent('ssx:turf', { detail: ev })); } catch (e) { /* old browser */ }
  try { window.SSX?.emit?.('turf:' + type, ev); } catch (e) { /* bus optional */ }
  if (type !== 'change') emit('change', { what: type, block: extra.block });
}
function on(a, b) { const [k, f] = typeof a === 'function' ? ['*', a] : [String(a), b]; if (typeof f !== 'function') return () => {}; if (!subs.has(k)) subs.set(k, new Set()); subs.get(k).add(f); return () => subs.get(k)?.delete(f); }
function here() { const s = surf(), i = s?.info; if (!i || i.name !== 'Mars' || !i.colony) return null; return { x: i.x - i.colony.x, z: i.z - i.colony.z, info: i, cx: i.colony.x, cz: i.colony.z }; }
function flatsOrigin(h) { // AJ-relative origin of Red Tape Flats (live from the city registry when present)
  const d = h?.info?.colony?.districts?.find?.(x => x.id === FLATS); return d ? [d.x - h.cx, d.z - h.cz] : FLATS_AJ;
}
let ORG = FLATS_AJ;
const aj = loc => [ORG[0] + loc[0], ORG[1] + loc[1]];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const byId = id => BLOCKS.find(b => b.id === id) || null;
const gname = g => GANGS[g]?.name || g;
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const dirTo = (from, to) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180 / Math.PI) + 360) % 360 / 45) % 8];
const pick = a => a[Math.floor(Math.random() * a.length)];
const owned = () => BLOCKS.filter(b => S.owners[b.id] === 'player');
function blockAt(p) { // p AJ-relative [x,z]
  const o = ORG; if (Math.hypot(p[0] - o[0], p[1] - o[1]) > FLATS_R) return null;
  let best = null, bd = 1e9; for (const b of BLOCKS) { const d = dist(p, aj(b.c)); if (d < bd) { bd = d; best = b; } } return best;
}
const locked = b => b.hq && S.owners[b.id] !== 'player' && owned().length < 2;
const perMin = () => owned().reduce((n, b) => n + (fight?.block === b.id && fight.kind === 'defend' ? 0 : b.income), 0);

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
  const s = surf(); if (!s?.scene) return fallback; const list = terrainMeshes(s.scene); if (!list.length) return fallback;
  V0.set(wx, 4000, wz); ray.set(V0, DOWN); ray.far = 8000; const hit = ray.intersectObjects(list, false)[0]; return hit ? hit.point.y : fallback;
}

// ---------- world presence: one flag beacon per block + the turf map beacon + a fight zone ring ----------
let G = null, beacons = [], zoneRing = null;
const hex = c => '#' + c.toString(16).padStart(6, '0');
function labelTex(text, col) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 64; const x = c.getContext('2d');
  let fs = 28; x.font = `bold ${fs}px system-ui, sans-serif`; while (fs > 14 && x.measureText(text).width > 290) { fs -= 2; x.font = `bold ${fs}px system-ui, sans-serif`; } x.textAlign = 'center'; x.textBaseline = 'middle'; const w = Math.min(314, x.measureText(text).width + 26);
  x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(160 - w / 2, 8, w, 48); x.fillStyle = col; x.fillText(text, 160, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeBeacon(col, text, r, beamH = 60) {
  const g = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, beamH, 8, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.y = beamH / 2 - 20; g.add(beam);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), new THREE.MeshLambertMaterial({ color: 0x222222 })); pole.position.y = 1.5; g.add(pole);
  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); cloth.position.set(0.58, 2.6, 0); g.add(cloth);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex(text, hex(col)), transparent: true, depthWrite: false })); sp.position.y = 4; sp.scale.set(4.6, 0.92, 1); g.add(sp);
  g.userData = { ring, sp, text, beam, cloth, col }; return g;
}
function restyle(g, text, col) {
  const u = g.userData; if (u.text !== text || u.col !== col) { const m = u.sp.material; m.map?.dispose(); m.map = labelTex(text, hex(col)); m.needsUpdate = true; u.text = text; }
  if (u.col !== col) { u.col = col; u.ring.material.color.setHex(col); u.beam.material.color.setHex(col); u.cloth.material.color.setHex(col); }
}
const flagText = b => `🚩 ${b.name.toUpperCase()} · ${S.owners[b.id] === 'player' ? 'YOURS' : gname(S.owners[b.id]).toUpperCase()}`;
function build(h) {
  const s = surf(); ORG = flatsOrigin(h); G = new THREE.Group(); G.name = 'mars-turf'; s.scene.add(G); beacons = [];
  const add = (loc, kind, col, text, ref) => { const at = aj(loc), g = makeBeacon(col, text, R_FLAG); g.position.set(h.cx + at[0], h.info.y - 1.7, h.cz + at[1]); G.add(g); beacons.push({ g, at, kind, ref, ground: false }); };
  for (const b of BLOCKS) add(b.flag, 'block', GANGS[S.owners[b.id]].col, flagText(b), b.id);
  add(MAP_AT, 'map', 0xffffff, '🗺️ TURF MAP', null);
  zoneRing = new THREE.Mesh(new THREE.RingGeometry(R_ZONE - 0.6, R_ZONE, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  zoneRing.rotation.x = -Math.PI / 2; zoneRing.visible = false; G.add(zoneRing);
}
function teardown() { if (G) { G.parent?.remove(G); G.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose?.(); }); } G = null; beacons = []; zoneRing = null; }
function syncBeacons() { for (const bc of beacons) if (bc.kind === 'block') { const b = byId(bc.ref); restyle(bc.g, flagText(b), GANGS[S.owners[b.id]].col); } }

// ---------- spawning engines (feature-detected) ----------
function engine(noRaids) {
  if (!noRaids && typeof window.SSX?.raids?.start === 'function') return 'raids';
  const g = window.SSX?.gang; if (g && (typeof g.spawn === 'function' || typeof g.spawnCrew === 'function')) return 'gang';
  if (typeof window.SSX?.city?.hostiles === 'function' || typeof game()?.hostiles === 'function') return 'core';
  return 'debug';
}
const coreAgents = f => { // live turf defenders near this fight's flag (stragglers from an old fight elsewhere don't block it)
  const h = here(), fl = f && h ? aj(byId(f.block).flag) : null;
  try { return (game()?.debug?.agents?.() || []).filter(a => a.src === 'turf' && (!fl || Math.hypot(a.x - h.cx - fl[0], a.z - h.cz - fl[1]) < 90)); } catch (e) { return []; }
};
function aliveCount(f) {
  let n = coreAgents(f).length;
  if (f.handles?.length) n += f.handles.filter(x => x && !x.dead && x.alive !== false && !(x.hp <= 0) && !x.removed).length;
  if (f.engine === 'debug') n += (game()?.debug?.agents?.() || []).filter(a => a.src === 'debug').length;
  return n;
}
function waveTypes(f) { const G0 = GANGS[f.gang], n = f.plan[f.wave - 1]; const out = []; for (let k = 0; k < n; k++) out.push(k === n - 1 && f.wave === f.waves ? G0.types[G0.types.length - 1] : G0.types[k % G0.types.length]); return out; }
function spawnSpot(h, f) { // world coords ~14 m from the flag on the far side from the player
  const fl = aj(byId(f.block).flag); const a = Math.atan2(fl[1] - h.z, fl[0] - h.x) + (Math.random() - 0.5) * 1.2;
  let x = h.cx + fl[0] + Math.cos(a) * 12, z = h.cz + fl[1] + Math.sin(a) * 12;
  try { const q = window.SSX?.city?.freeSpot?.(x, z, 1.2); if (q && isFinite(q.x)) { x = q.x; z = q.z; } } catch (e) { /* keep */ }
  return { x, z };
}
function spawnWave(h, f, types) { // returns number spawned
  const p = spawnSpot(h, f), o = { faction: f.gang, r: 5, src: 'turf', aggro: true };
  if (f.engine === 'gang') {
    const g = window.SSX.gang; let r = null;
    try { r = (g.spawn || g.spawnCrew).call(g, { gang: f.gang, faction: f.gang, types, count: types.length, at: { x: p.x, z: p.z }, world: true, hostile: true, src: 'turf' }); } catch (e) { console.warn('turf SSX.gang', e); }
    if (Array.isArray(r) && r.length) { f.handles.push(...r); return r.length; }
    if (typeof r === 'number' && r > 0) return r; // spawned as core agents: tracked through src 'turf'
  }
  if (f.engine === 'debug') { let n = 0; for (const t of types) if (game()?.debug?.spawn?.(t, 14, Math.random() * 6)) n++; return n; }
  try { const c = window.SSX?.city; return (c?.hostiles ? c.hostiles(types, p.x, p.z, o) : game().hostiles(types, p.x, p.z, o)) || 0; } catch (e) { console.warn('turf hostiles', e); return 0; }
}

// ---------- fights ----------
let fight = null; // { kind, block, gang, waves, wave, plan, phase, t, out, engine, handles, pending, raidId }
let counterT = COUNTER_MIN + Math.random() * (COUNTER_MAX - COUNTER_MIN);
function plan(b, kind) { const base = 2 + b.tier; return kind === 'take' ? (b.tier >= 2 ? [base, base + 1, base + 2] : [base, base + 1]) : [base, base + 1]; }
function startFight(kind, b, gang) {
  // v7.5.3: SSX.raids only runs takeovers; defends (alert phase, own waves) use the next engine down
  let eng = engine(); if (eng === 'raids' && kind !== 'take') eng = engine(true);
  const P = plan(b, kind);
  fight = { kind, block: b.id, gang, waves: P.length, wave: 0, plan: P, phase: kind === 'defend' ? 'alert' : 'gap', t: kind === 'defend' ? ALERT_T : 2.5, out: 0, engine: eng, handles: [], pending: 0, kills: 0 };
  try { window.SSX?.city?.npcReserve?.('turf', Math.min(8, P[P.length - 1])); } catch (e) { /* optional */ }
  if (eng === 'raids' && kind === 'take') startRaid();
}
function startRaid() { // Steve's engine runs the waves, we keep score
  const f = fight, b = byId(f.block), at = aj(b.flag);
  let r = null; try { r = window.SSX.raids.start({ id: 'turf-' + b.id, pos: [at[0], at[1]], radius: R_ZONE, attackers: 'gang', waves: f.plan.map(count => ({ count })), label: `${GANGS[f.gang].name} hold ${b.name}`,
    onWin: () => { if (fight === f) win(); }, onLose: info => { if (fight === f) lose(info?.why === 'down' ? 'down' : 'raid'); } }); } catch (e) { console.warn('turf raids', e); }
  if (r?.ok) { f.raidId = r.id; f.phase = 'raid'; try { f.unsub = window.SSX.raids.on?.('raid:wave', i => { if (fight === f && (!i?.id || i.id === r.id)) { f.wave = i.wave || f.wave + 1; emit('wave', { block: f.block, gang: f.gang, wave: f.wave, waves: f.waves }); } }); } catch (e) { /* optional */ } }
  else f.engine = engine(true); // raid refused (one at a time): run our own waves
}
function endFight() {
  const f = fight; if (!f) return; fight = null;
  try { f.unsub?.(); } catch (e) { /* ignore */ }
  if (f.raidId) try { window.SSX?.raids?.stop?.(f.raidId); } catch (e) { /* already over */ }
  try { window.SSX?.city?.npcReserve?.('turf', 0); } catch (e) { /* optional */ }
  if (zoneRing) zoneRing.visible = false; syncBeacons(); renderHud(); render();
}
function win() {
  const f = fight, b = byId(f.block), G0 = GANGS[f.gang];
  if (f.kind === 'take') {
    S.lostBy[b.id] = f.gang; S.owners[b.id] = 'player'; S.taken++; const cr = 60 + 40 * b.tier, xp = 30 + 20 * b.tier;
    try { game()?.reward?.(xp, cr); } catch (e) { /* ignore */ }
    try { if (!game()?.flag?.('turf:first')) game()?.setFlag?.('turf:first'); } catch (e) { /* optional */ }
    save(); toast(`🚩 ${b.name} is yours. ${G0.name} will want it back. +${cr} cr, +${xp} XP. Pays ${b.income} cr/min.`, 4200);
    emit('captured', { block: b.id, gang: f.gang, credits: cr, xp });
  } else {
    S.defended++; const cr = 40 + 20 * b.tier; try { game()?.reward?.(10 + 10 * b.tier, cr); } catch (e) { /* ignore */ }
    save(); toast(`🛡️ ${b.name} held. ${G0.name} crawl home. +${cr} cr.`, 3600); emit('defended', { block: b.id, gang: f.gang, credits: cr });
  }
  endFight();
}
function lose(why) {
  const f = fight, b = byId(f.block), G0 = GANGS[f.gang];
  const msg = { down: 'You went down.', fled: 'You left the block.', retreat: 'You pulled out.', noshow: 'You never showed up.', left: 'You left the Flats.', raid: 'The crew held.' }[why] || 'It went bad.';
  if (f.kind === 'take') { toast(`❌ Takeover failed: ${msg} ${G0.name} still run ${b.name}.`, 3600); emit('failed', { block: b.id, gang: f.gang, why }); }
  else { S.owners[b.id] = f.gang; delete S.lostBy[b.id]; S.lost++; save(); toast(`💀 ${G0.name} took ${b.name} back. ${msg}`, 3800); emit('lost', { block: b.id, gang: f.gang, why }); }
  endFight();
}
function attack(id, opts = {}) {
  const b = byId(id), h = here(), st = app()?.state;
  if (!b) return { ok: false, msg: 'No such block.' };
  if (!h || !st?.onSurface) return { ok: false, msg: 'Land on Mars first.' };
  if (fight) return { ok: false, msg: fight.block === id ? 'Already fighting for it.' : `Busy: ${byId(fight.block).name} first.` };
  if (S.owners[id] === 'player') return { ok: false, msg: `${b.name} is already yours.` };
  if (locked(b)) return { ok: false, msg: `${b.name} is Saltblood HQ. Hold two blocks first.` };
  const d = dist([h.x, h.z], aj(b.flag));
  if (!opts.force && d > R_ZONE) { S.track = id; save(); syncBeacons(); return { ok: false, msg: `Get to ${b.name} first: ${Math.round(d)} m ${dirTo([h.x, h.z], aj(b.flag))}. Its flag is lit.` }; }
  const gang = S.owners[id]; startFight('take', b, gang); S.track = null; save();
  radio(pick([`You want ${b.name}? Come take it.`, `Wrong block, friend. Last mistake.`, `${GANGS[gang].name} don\u2019t rent. Get them.`]), GANGS[gang].name);
  emit('attack', { block: id, gang, waves: fight.waves, engine: fight.engine }); renderHud(); return { ok: true, msg: `⚔️ Takeover of ${b.name}: survive ${fight.waves} waves of ${GANGS[gang].name}.` };
}
function counter(id) { // a gang that lost a block hits back
  if (fight) return { ok: false, msg: 'Already fighting.' };
  const list = owned(); const b = id ? byId(id) : pick(list); if (!b || S.owners[b.id] !== 'player') return { ok: false, msg: 'You hold no such block.' };
  const gang = S.lostBy[b.id] || b.gang; startFight('defend', b, gang);
  const h = here(), d = h ? dist([h.x, h.z], aj(b.flag)) : 999; if (d < R_ZONE) fight.t = 6;
  radio(`${GANGS[gang].name} are rolling on ${b.name}. Get there or lose it.`, 'Penny-ante');
  emit('counter', { block: b.id, gang, timeLeft: fight.t }); renderHud(); return { ok: true, msg: `🚨 Counter-attack on ${b.name}.` };
}
function stepFight(dt, h) {
  const f = fight, b = byId(f.block), fl = aj(b.flag), d = dist([h.x, h.z], fl);
  if (zoneRing) { zoneRing.visible = f.phase !== 'alert'; const y = groundY(h.cx + fl[0], h.cz + fl[1], h.info.y - 1.7); zoneRing.position.set(h.cx + fl[0], y + 0.2, h.cz + fl[1]); zoneRing.material.opacity = 0.25 + 0.2 * Math.sin(performance.now() / 260); }
  if (game()?.isDown?.()) { lose('down'); return; }
  if (f.phase === 'alert') { f.t -= dt; if (d < R_ZONE) { f.phase = 'gap'; f.t = 2.5; if (f.engine === 'raids') startRaid(); toast(`🛡️ Hold ${b.name}: ${f.waves} waves of ${GANGS[f.gang].name}.`, 2600); } else if (f.t <= 0) lose('noshow'); return; }
  if (f.phase === 'raid') return; // SSX.raids owns the waves
  if (d > R_ZONE + 6) { f.out += dt; if (f.out > LEASH_T) { lose('fled'); return; } } else f.out = 0;
  if (f.phase === 'gap') { f.t -= dt; if (f.t <= 0) { f.wave++; f.pending = f.plan[f.wave - 1]; f.phase = 'fight'; f.since = 0; f.retry = 0; emit('wave', { block: f.block, gang: f.gang, wave: f.wave, waves: f.waves }); toast(`⚔️ Wave ${f.wave}/${f.waves}: ${GANGS[f.gang].name}`, 1800); } return; }
  if (f.phase === 'fight') {
    f.since += dt; f.retry -= dt;
    if (f.pending > 0 && f.retry <= 0) { const types = waveTypes(f).slice(-f.pending); const n = spawnWave(h, f, types); f.pending -= n; f.retry = 1; if (n) f.since = 0; }
    const alive = aliveCount(f); f.alive = alive;
    if (f.pending <= 0 && alive === 0 && f.since > 1.2) { if (f.wave >= f.waves) win(); else { f.phase = 'gap'; f.t = 4; toast(`✅ Wave ${f.wave} down. More coming.`, 1600); } }
  }
}

// ---------- income ----------
let payAt = Date.now(), toastT = 0;
function accrue(now = Date.now()) {
  const pm = perMin(), mins = Math.min(OFFLINE_CAP_MIN, Math.max(0, (now - (S.lastAt || now)) / 60000)); S.lastAt = now;
  if (pm > 0) S.purse += pm * mins;
}
function payout(force) {
  const n = Math.floor(S.purse); if (n < 1 || (!force && !game())) return 0;
  S.purse -= n; S.earned += n; try { game()?.reward?.(0, n); } catch (e) { /* ignore */ } save();
  const t = performance.now(); if (n >= 5 && !fight && (force || t - toastT > 120000)) { toastT = t; toast(`💵 Turf cut: +${n} cr from ${owned().length} block${owned().length === 1 ? '' : 's'}.`, 2200); }
  emit('income', { credits: n, perMin: perMin(), earned: S.earned }); return n;
}

// ---------- contraband price hook (PR #9 exposes none yet; see TURF.md for the one-liner) ----------
function priceMultiplier(district, pos) {
  let p = null; if (Array.isArray(pos)) p = pos; else if (pos && isFinite(pos.x)) p = [pos.x, pos.z];
  if (!p) { if (district && !/rough|flats|red-tape/i.test(String(district))) return 1; const h = here(); if (!h) return 1; p = [h.x, h.z]; }
  const b = blockAt(p); if (!b || S.owners[b.id] !== 'player') return 1;
  return Math.min(1.5, 1.25 + 0.05 * (owned().length - 1));
}
let hooked = false;
function hookContraband() {
  if (hooked) return; const C = window.SSX?.contraband; if (!C) return;
  const fnName = ['registerPriceModifier', 'addPriceModifier', 'registerPriceHook', 'addPriceHook', 'onPrice'].find(k => typeof C[k] === 'function');
  if (fnName) { try { C[fnName]((ctx = {}, pos) => priceMultiplier(ctx.district ?? ctx, ctx.pos ?? pos)); hooked = true; } catch (e) { console.warn('turf contraband hook', e); } }
  else if (Array.isArray(C.priceModifiers)) { C.priceModifiers.push((ctx = {}) => priceMultiplier(ctx.district, ctx.pos)); hooked = true; }
}

// ---------- tick ----------
let lastT = performance.now(), lastFrame = 0, hookT = 0;
function loop() { requestAnimationFrame(loop); const now = performance.now(); if (now - lastFrame < 100) return; const dt = Math.min(0.5, (now - lastT) / 1000); lastT = now; lastFrame = now; try { turfTick(dt); } catch (e) { console.warn('turf tick', e); } }
export function turfTick(dt) {
  if ((hookT += dt) > 2) { hookT = 0; hookContraband(); }
  const wall = Date.now(); accrue(wall); if (wall - payAt >= PAY_EVERY * 1000) { payAt = wall; payout(); } // wall clock: pays on time even at low fps
  const st = app()?.state, h = here(), s = surf();
  if (!h || !st?.onSurface || st.transitioning) { if (G && (!s || G.parent !== s.scene || !h)) teardown(); if (fight && !st?.transitioning) lose('left'); setNear(null); renderHud(); return; }
  if (!G || G.parent !== s.scene) { teardown(); build(h); }
  const i = h.info, now = performance.now(), slow = !i.driving || Math.abs(i.speed) < 4;
  let nb = null;
  for (const b of beacons) {
    const d = Math.hypot(h.x - b.at[0], h.z - b.at[1]);
    if (!b.ground && d < 180) { const y = groundY(h.cx + b.at[0], h.cz + b.at[1], null); if (y != null) { b.g.position.y = y; b.ground = true; } }
    const hot = (b.kind === 'block' && (S.track === b.ref || fight?.block === b.ref));
    b.g.userData.ring.material.opacity = (hot ? 0.6 : 0.3) + 0.25 * Math.sin(now / (hot ? 160 : 320));
    b.g.userData.beam.material.opacity = hot ? 0.6 : 0.25;
    if (!i.inside && slow && d < R_FLAG && (!nb || d < nb.d)) nb = { d, kind: b.kind, ref: b.ref };
  }
  setNear(nb);
  if (fight) stepFight(dt, h);
  else if (owned().length && Math.hypot(h.x - ORG[0], h.z - ORG[1]) < 700) { counterT -= dt; if (counterT <= 0) { counterT = COUNTER_MIN + Math.random() * (COUNTER_MAX - COUNTER_MIN); counter(); } }
  renderHud();
}

// ---------- UI (high contrast: black buttons, white text, 44px+ targets, window.__onTap) ----------
const css = `
#turfHud{position:fixed;z-index:12;left:50%;transform:translateX(-50%);top:calc(112px + env(safe-area-inset-top));display:none;align-items:center;gap:8px;max-width:calc(100vw - 16px);box-sizing:border-box;padding:6px 6px 6px 12px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:700 13px/1.25 system-ui,sans-serif;pointer-events:auto}
@media (max-width:640px){#turfHud{top:calc(212px + env(safe-area-inset-top));width:calc(100vw - 16px)} #turfHud .tx{flex:1}}
body.surface #turfHud.show{display:flex} #turfHud .tx{min-width:0} #turfHud .l1,#turfHud .l2{white-space:nowrap;overflow:hidden;text-overflow:ellipsis} #turfHud .l1{font-weight:800} #turfHud .warn{color:#ffd400}
#turfHud button,#turfAct{min-height:44px;min-width:64px;padding:0 12px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation;flex:none}
#turfAct{position:fixed;z-index:13;left:calc(10px + env(safe-area-inset-left));top:44%;display:none;min-height:52px;min-width:130px;max-width:70vw} body.surface #turfAct.show{display:block} body.indoors #turfAct{display:none!important}
#turfPanel{position:fixed;inset:0;z-index:61;display:none;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.55)} #turfPanel.show{display:flex}
#turfPanel .wrap{width:min(460px,calc(100vw - 12px));max-height:calc(100vh - 24px - env(safe-area-inset-top));display:flex;flex-direction:column;overflow:hidden;margin:0 6px calc(8px + env(safe-area-inset-bottom));padding:14px;border-radius:16px;background:#000;color:#fff;border:2px solid #fff;font:14px system-ui,sans-serif;box-sizing:border-box}
#turfBody{flex:1 1 auto;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch} #turfPanel .msg,#turfPanel .foot{flex:none}
#turfPanel h2{margin:0 0 2px;font-size:18px} #turfPanel .sub{margin:0 0 8px;font-size:13px;opacity:.9}
#turfPanel .it{padding:9px 0;border-top:1px solid rgba(255,255,255,.3)} #turfPanel .it b{font-size:15px} #turfPanel .it small{display:block;font-size:12px;opacity:.9;margin-top:2px}
#turfPanel .chip{font-style:normal;margin-right:6px}
#turfPanel button{width:100%;min-height:46px;margin-top:6px;border-radius:10px;background:#000;color:#fff;border:2px solid #fff;font:800 14px system-ui,sans-serif;touch-action:manipulation} #turfPanel button:disabled{opacity:.55}
#turfPanel .msg{min-height:1.2em;margin:8px 0;font-weight:700} #turfPanel .foot{display:flex;gap:8px}
`;
let hud, hudTx, hudBtn, actBtn, panel, body, msgEl, near = null, lastMsg = '', lastTouchAct = 0, hudKey = '';
function tap(el, fn) {
  const g = e => { const n = performance.now(); if (e?.type === 'click' && n - lastTouchAct < 700) return; if (e?.type === 'pointerup') lastTouchAct = n; fn(e); };
  (window.__onTap || ((x, f) => x.addEventListener('click', f)))(el, g);
}
const isTouch = () => document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
// Phone hotkey dock, shared by the Marsmania add-ons (contraband B, jobs J, turf K, beltway …). Whichever loads first
// creates #ssxDock on the right edge (between the top HUD and the Jump/Run column); each adds one 48px black button.
// Shown only on touch devices on the surface, where there's no keyboard. Bound with window.__onTap.
// v7.5.3: the dock sits at a fixed top, and the #surfBtns column (Race / Pet / Jump / Run, bottom-up) grows into it on
// short phones - the dock covered 🏁 Race at a start line. When they overlap, the dock steps left of the column.
function dockAvoid(d) {
  const fix = () => { const sb = document.getElementById('surfBtns'), m = document.getElementById('roverMenu'); if (!d.isConnected || !sb) return;
    d.style.visibility = m?.classList.contains('show') ? 'hidden' : ''; // the ☰ menu wins (no :has() on old WebKit)
    d.style.right = ''; const a = d.getBoundingClientRect(), b = sb.getBoundingClientRect();
    if (a.width && b.width && a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right) d.style.right = `${Math.round(innerWidth - b.left + 8)}px`; };
  setInterval(fix, 300); addEventListener('resize', fix);
  const m = document.getElementById('roverMenu'); if (m) try { new MutationObserver(fix).observe(m, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* interval only */ }
}
function dockButton(id, label, aria, order, fn) {
  if (!document.getElementById('ssxDockCss')) { const st = document.createElement('style'); st.id = 'ssxDockCss'; st.textContent = `#ssxDock{position:fixed;z-index:12;right:calc(8px + env(safe-area-inset-right));top:calc(300px + env(safe-area-inset-top));display:none;flex-direction:column;gap:8px;pointer-events:none}
body.surface.touch #ssxDock{display:flex} @media (pointer:coarse){body.surface #ssxDock{display:flex}}
body.danger-standoff #ssxDock,body:has(#roverMenu.show) #ssxDock{display:none!important}
#ssxDock button{pointer-events:auto;min-width:52px;min-height:48px;padding:3px 6px;border-radius:12px;background:#000;color:#fff;border:2px solid #fff;font:800 11px/1.15 system-ui,sans-serif;white-space:pre-line;touch-action:manipulation}`; document.head.appendChild(st); }
  let d = document.getElementById('ssxDock'); if (!d) { d = document.createElement('div'); d.id = 'ssxDock'; document.body.appendChild(d); dockAvoid(d); }
  let b = document.getElementById(id); if (b) return b;
  b = document.createElement('button'); b.id = id; b.type = 'button'; b.textContent = label; b.setAttribute('aria-label', aria); b.style.order = String(order); d.appendChild(b); tap(b, fn); return b;
}
function ui() {
  if (panel) return; const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'turfHud'; hud.innerHTML = '<div class="tx"><div class="l1"></div><div class="l2"></div></div><button id="turfRetreat" type="button" aria-label="Retreat">Retreat</button>'; document.body.appendChild(hud);
  hudTx = [hud.querySelector('.l1'), hud.querySelector('.l2')]; hudBtn = hud.querySelector('#turfRetreat');
  tap(hudBtn, () => retreat()); tap(hud.querySelector('.tx'), () => open());
  actBtn = document.createElement('button'); actBtn.id = 'turfAct'; actBtn.type = 'button'; document.body.appendChild(actBtn); tap(actBtn, () => doAction());
  panel = document.createElement('div'); panel.id = 'turfPanel'; panel.innerHTML = '<div class="wrap" role="dialog" aria-label="Turf"><div id="turfBody"></div><div class="msg" id="turfMsg"></div><div class="foot"><button id="turfClose" type="button">Close</button></div></div>';
  document.body.appendChild(panel); body = panel.querySelector('#turfBody'); msgEl = panel.querySelector('#turfMsg');
  tap(panel.querySelector('#turfClose'), close);
  dockButton('dockTurf', '🚩\nTurf', 'Turf (K)', 3, () => panel.classList.contains('show') ? close() : open());
  addEventListener('keydown', e => {
    if (e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || !app()?.state?.onSurface) return;
    if (e.code === 'KeyK') { panel.classList.contains('show') ? close() : open(); }
    else if (e.code === 'KeyY' && actBtn.classList.contains('show')) { e.preventDefault(); doAction(); }
  });
}
function retreat() { if (!fight) return { ok: false }; lose('retreat'); return { ok: true }; }
function actionFor() {
  if (!near) return null;
  if (near.kind === 'map') return { id: 'map', label: '🗺️ Turf map' };
  const b = byId(near.ref);
  if (fight) return fight.block === b.id ? null : { id: 'map', label: `🚩 ${b.name}` };
  if (S.owners[b.id] === 'player') return { id: 'map', label: `🚩 ${b.name}: yours` };
  if (locked(b)) return { id: 'map', label: `🔒 ${b.name}` };
  return { id: 'take:' + b.id, label: `⚔️ Take ${b.name}` };
}
function doAction() {
  const a = actionFor(); if (!a) return;
  if (a.id === 'map') open(); else { const r = attack(a.id.slice(5)); toast(r.msg, 2600); }
  refreshAct(true);
}
let actKey = '';
function refreshAct(force) { if (!actBtn) return; const a = actionFor(), k = a ? a.id + a.label : ''; if (!force && k === actKey) return; actKey = k; actBtn.textContent = a ? a.label + (isTouch() ? '' : ' (Y)') : ''; actBtn.classList.toggle('show', !!a); }
function setNear(nb) { near = nb; refreshAct(); }
function renderHud() {
  if (!hud) return; refreshAct();
  if (!fight) { if (hud.classList.contains('show')) { hud.classList.remove('show'); hudKey = ''; } if (panel?.classList.contains('show')) renderPanelThrottled(); return; }
  const f = fight, b = byId(f.block), h = here(), G0 = GANGS[f.gang];
  const d = h ? Math.round(dist([h.x, h.z], aj(b.flag))) : null;
  let l1, l2, warn = false;
  if (f.phase === 'alert') { l1 = `🚨 ${G0.name.toUpperCase()} HITTING ${b.name.toUpperCase()}`; l2 = `Get there · ⏱ ${fmtT(f.t)}${d != null ? ` · ${d} m ${dirTo([h.x, h.z], aj(b.flag))}` : ''}`; warn = f.t < 20; }
  else {
    l1 = `${f.kind === 'take' ? '⚔️ TAKEOVER' : '🛡️ DEFEND'} · ${b.name.toUpperCase()} · Wave ${Math.max(1, f.wave)}/${f.waves}`;
    if (f.phase === 'raid') l2 = `${G0.name} crew inbound`;
    else if (f.out > 0) { l2 = `Back in the zone! ${fmtT(LEASH_T - f.out)}`; warn = true; }
    else if (f.phase === 'gap') l2 = f.wave ? 'Reload. Next wave incoming.' : `${G0.name} gearing up…`;
    else l2 = `${(f.alive ?? 0) + Math.max(0, f.pending)} ${G0.name} left · stay in the ring`;
  }
  const k = l1 + '|' + l2 + warn;
  if (k !== hudKey) { hudKey = k; hudTx[0].textContent = l1; hudTx[1].textContent = l2; hudTx[0].classList.toggle('warn', warn); hudBtn.textContent = f.phase === 'alert' ? 'Let it go' : 'Retreat'; }
  hud.classList.add('show');
  if (panel?.classList.contains('show')) renderPanelThrottled();
}
let panelT = 0; function renderPanelThrottled() { const n = performance.now(); if (n - panelT > 1000) { panelT = n; render(); } }
function open() { ui(); lastMsg = ''; panel.classList.add('show'); if (document.pointerLockElement) document.exitPointerLock(); render(); }
function close() { panel?.classList.remove('show'); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function render() {
  if (!panel || !panel.classList.contains('show')) return;
  const h = here(), inc = API.income();
  let html = `<h2>🚩 Red Tape Flats turf</h2><p class="sub">You hold ${inc.blocks}/${BLOCKS.length} blocks · ${inc.perMin} cr/min · ${S.earned} cr earned. Selling on your turf pays ${Math.round((Math.min(1.5, 1.25 + 0.05 * Math.max(0, inc.blocks - 1)) - 1) * 100)}% more.</p>`;
  for (const b of BLOCKS) {
    const o = S.owners[b.id], mine = o === 'player', fb = fight?.block === b.id, d = h ? Math.round(dist([h.x, h.z], aj(b.flag))) : null, lk = locked(b);
    const status = fb ? (fight.kind === 'take' ? '⚔️ Takeover in progress' : '🚨 Under attack') : mine ? `Yours · ${GANGS[S.lostBy[b.id]]?.name || 'someone'} want it back` : lk ? '🔒 Hold two blocks first' : 'Hostile';
    let btn = '';
    if (!mine && !fb && !lk) { const nearB = d != null && d <= R_ZONE; btn = `<button type="button" data-take="${b.id}" ${fight ? 'disabled' : ''}>${nearB ? `⚔️ Attack ${esc(b.name)}` : S.track === b.id ? `📍 Tracking · ${d ?? '?'} m` : `📍 Track ${esc(b.name)}${d != null ? ` (${d} m)` : ''}`}</button>`; }
    html += `<div class="it"><b><span class="chip" aria-hidden="true" style="all:unset;color:${hex(GANGS[o].col)};margin-right:6px">■</span>${esc(b.name)} · ${esc(mine ? 'You' : gname(o))}</b><small>${b.income} cr/min · tier ${b.tier} · ${esc(b.note)}</small><small>${esc(status)}</small>${btn}</div>`;
  }
  html += `<p class="sub" style="margin-top:8px">${Object.entries(GANGS).filter(([k]) => k !== 'player').map(([, g]) => `<b>${esc(g.name)}</b>: ${esc(g.blurb)}`).join('<br>')}</p><p class="sub">Walk up to a block flag 🚩 and attack, then survive the waves inside the ring. Lost gangs counter-attack: get there in time or lose the block. Keys: K turf, Y action.</p>`;
  body.innerHTML = html; msgEl.textContent = lastMsg;
  body.querySelectorAll('button[data-take]').forEach(bt => tap(bt, () => { const r = attack(bt.dataset.take); lastMsg = r.msg; if (r.ok) { close(); toast(r.msg, 2600); return; } render(); }));
}

// ---------- boot ----------
const pub = b => ({ id: b.id, name: b.name, owner: S.owners[b.id], ownerName: S.owners[b.id] === 'player' ? 'You' : gname(S.owners[b.id]), income: b.income, tier: b.tier, flag: aj(b.flag), centre: aj(b.c), r: R_ZONE, hq: !!b.hq, locked: locked(b), lostBy: S.lostBy[b.id] || null, status: fight?.block === b.id ? (fight.kind === 'take' ? 'takeover' : 'counter') : 'idle' });
const API = {
  gangs: Object.fromEntries(Object.entries(GANGS).filter(([k]) => k !== 'player').map(([k, g]) => [k, { name: g.name, col: g.col, blurb: g.blurb }])),
  blocks: () => BLOCKS.map(pub),
  owner: id => (byId(id) ? S.owners[id] : null),
  ownerAt: pos => { let p = Array.isArray(pos) ? pos : pos && isFinite(pos.x) ? [pos.x, pos.z] : null; if (!p) { const h = here(); if (!h) return null; p = [h.x, h.z]; } const b = blockAt(p); return b ? { block: b.id, owner: S.owners[b.id], ownerName: S.owners[b.id] === 'player' ? 'You' : gname(S.owners[b.id]) } : null; },
  attack: (id, opts) => attack(id, opts), retreat, counter: id => counter(id),
  income: () => ({ perMin: perMin(), pending: Math.floor(S.purse), earned: S.earned, blocks: owned().length }),
  fight: () => fight ? { kind: fight.kind, block: fight.block, gang: fight.gang, wave: fight.wave, waves: fight.waves, alive: fight.alive ?? 0, pending: Math.max(0, fight.pending), phase: fight.phase, timeLeft: fight.phase === 'alert' || fight.phase === 'gap' ? Math.round(fight.t * 10) / 10 : null, engine: fight.engine } : null,
  priceMultiplier, on, open, close,
  stats: () => ({ taken: S.taken, defended: S.defended, lost: S.lost, earned: S.earned }),
  debug: {
    goto(id) { const h = here(), s = surf(), b = byId(id || fight?.block || 'hab-stacks'); if (!h || !b) return false; const f = aj(b.flag); s.debugMove(h.cx + f[0] + 2.5, h.cz + f[1] + 2.5, 0); return true; },
    clearWave() { let n = 0; const g = game(); for (let k = 0; k < 40; k++) { const list = g?.debug?.agents?.() || []; const i = list.findIndex(a => a.src === 'turf' || (fight?.engine === 'debug' && a.src === 'debug')); if (i < 0) break; g.debug.kill(i, {}); n++; }
      if (fight?.handles) for (const x of fight.handles) { try { x.kill ? x.kill() : (x.hp = 0, x.dead = true); } catch (e) { /* ignore */ } n++; }
      if (fight?.engine === 'raids') { try { window.__raids?.killAll?.(); } catch (e) { /* optional */ } } return n; },
    counter: id => counter(id), arrive() { if (fight?.phase === 'alert') { API.debug.goto(fight.block); return true; } return false; },
    tickIncome(sec = 60) { S.lastAt -= sec * 1000; accrue(); return payout(true); },
    setOwner(id, o) { if (!byId(id) || !GANGS[o]) return false; if (o === 'player') S.lostBy[id] = S.owners[id] === 'player' ? (S.lostBy[id] || byId(id).gang) : S.owners[id]; S.owners[id] = o; save(); syncBeacons(); emit('change', { what: 'debug', block: id }); return true; },
    reset() { if (fight) endFight(); S = fresh(); save(); syncBeacons(); emit('change', { what: 'reset' }); },
    state: () => JSON.parse(JSON.stringify({ S, fight: fight && { ...fight, handles: fight.handles.length, unsub: undefined }, counterT, near, org: ORG })),
    engine
  }
};
(function boot() {
  if (!window.SSX || !window.__app) { setTimeout(boot, 200); return; }
  window.SSX.turf = API; ui(); accrue();
  try { window.SSX.registerMenuItem({ id: 'rmTurf', label: '🚩 Turf', onTap: () => open() }); } catch (e) { console.warn('turf menu', e); }
  requestAnimationFrame(loop);
})();
