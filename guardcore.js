// Heist guards: pure logic (no DOM, no three.js), so it unit-tests in node. guards.js wraps it with meshes, movement,
// hit boxes and world hooks. Coordinates in metres, world.js yaw convention (yaw 0 looks toward -z).
//
// Per heist there is one alert ladder:  calm -> investigate -> backup -> lockdown (-> sealed when the loot timer runs out)
//   calm:        guards walk their def.guards waypoints
//   investigate: an alarm / camera spot / a guard seeing you sends guards to the LAST KNOWN position
//   backup:      a guard reached the spot (or saw you, or investigateS ran out) and radios it in: +1 star, heist:alarm:response
//   lockdown:    after radioS the site locks down: guards hold the door + gate posts, break-in is slower, the escape ring
//                is wider and a loot timer (lockdownS) starts. At 0 the vault seals.
// Per guard: patrol | investigate | search | engage | post | down.

export const GUARD_DEFAULTS = { hp: 9, walk: 1.4, run: 3.2, fov: 110, range: 15, alertRange: 22, near: 2.5, spotRate: 1.5, fireCd: 1.6, dmg: 5, fireRange: 20, keep: 7, lose: 4, searchS: 3, waitS: 1.2 };
export const ALERT_DEFAULTS = { investigateS: 12, radioS: 3, lockdownS: 75, breakinMul: 2.5, escapeMul: 1.5 };
export const PHASES = ['calm', 'investigate', 'backup', 'lockdown', 'sealed'];

const pt = p => Array.isArray(p) ? { x: +p[0], z: +p[1] } : { x: +p.x, z: +p.z };
// def.guards entry: { id?, x, z, route?: [{x,z} | [x,z]], wait?, hp? }. The start point is the first waypoint.
export function normGuard(def, i = 0, o = {}) {
  const start = pt(def), route = [start, ...(def.route || []).map(pt)].filter(p => isFinite(p.x) && isFinite(p.z));
  const T = { ...GUARD_DEFAULTS, ...o };
  return { id: def.id || `guard${i}`, x: start.x, z: start.z, yaw: def.yaw ?? 0, route, wp: route.length > 1 ? 1 : 0, wait: 0, state: 'patrol',
    hp: def.hp ?? T.hp, meter: 0, last: null, lostT: 0, searchT: 0, fireCd: T.fireCd * (0.5 + (i % 3) * 0.25), seen: false, aware: false, post: null, T, downT: 0 };
}
// how many guards a heist may field. Phones keep the whole scene <= cap (12): world.npcBudget() counts ambient + security +
// hostiles + reservations, and world.js never drops below `minAmbient` (4) walkers, so the guards get what is left.
export function guardSlots(want, budget, { mobile = true, minAmbient = 4, maxPhone = 4, ambientOn = null } = {}) {
  want = Math.max(0, want | 0); if (!mobile || !budget) return Math.min(want, mobile ? maxPhone : want);
  const ambient = ambientOn ?? 0, others = Math.max(0, (budget.used | 0) - ambient); // non-ambient people already in the scene
  return Math.max(0, Math.min(want, maxPhone, (budget.cap ?? 12) - minAmbient - others));
}
// field of view: 0 when the point is out of the cone (or too far), else a 0.4..1 detection weight (closer = faster)
export function guardSees(g, px, pz, alert = false) {
  const dx = px - g.x, dz = pz - g.z, d = Math.hypot(dx, dz), R = alert ? g.T.alertRange : g.T.range;
  if (d > R) return 0; if (d < g.T.near) return 1;
  const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), cos = (dx * fx + dz * fz) / d;
  if (cos < Math.cos(g.T.fov * Math.PI / 360)) return 0;
  return 1 - d / R * 0.6;
}

export function createAlert(o = {}) {
  return { phase: 'calm', last: null, t: 0, lockLeft: 0, cfg: { ...ALERT_DEFAULTS, ...o }, log: [] };
}
const go = (A, p) => { A.log.push(p); A.phase = p; A.t = 0; return p; };
// an alarm / camera alert / guard spot at pos. Returns the new phase on a change, else null.
export function raiseAlert(A, pos) {
  if (pos) A.last = { x: pos.x, z: pos.z };
  if (A.phase === 'calm') return go(A, 'investigate');
  return null;
}
// advance the ladder. guards: the live list. Returns 'backup' | 'lockdown' | 'sealed' on the frame it happens, else null.
export function stepAlert(A, dt, guards = []) {
  A.t += dt;
  if (A.phase === 'investigate') {
    const found = guards.some(g => g.state !== 'down' && (g.state === 'engage' || g.state === 'search'));
    if (found || A.t >= A.cfg.investigateS || !guards.some(g => g.state !== 'down')) return go(A, 'backup');
  } else if (A.phase === 'backup') {
    if (A.t >= A.cfg.radioS) { A.lockLeft = A.cfg.lockdownS; return go(A, 'lockdown'); }
  } else if (A.phase === 'lockdown') {
    A.lockLeft = Math.max(0, A.lockLeft - dt); if (A.lockLeft <= 0) return go(A, 'sealed');
  }
  return null;
}
export const lockedDown = A => A.phase === 'lockdown' || A.phase === 'sealed';
// lockdown posts: the door first, then gates on the site ring (toward the door side and the two flanks)
export function lockdownPosts(site, door, n) {
  const out = [{ x: door.x, z: door.z }], a0 = Math.atan2(door.x - site.x, door.z - site.z), R = (site.r || 12) + 2;
  for (let i = 1; i < n; i++) { const a = a0 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.9; out.push({ x: site.x + Math.sin(a) * R, z: site.z + Math.cos(a) * R }); }
  return out;
}

// one guard, one frame. env: { px, pz, see(g) -> 0..1 (cone + line of sight, 0 when hidden), A (alert), dt }
// Returns { goal, speed, evt } where evt is 'spotted' (first sighting) | 'searched' | 'lost' | null. The caller moves the
// guard toward goal (with collisions) and turns it; this function only decides.
export function stepGuard(g, dt, env) {
  const T = g.T, A = env.A, alert = A && A.phase !== 'calm';
  if (g.state === 'down') { g.downT += dt; return { goal: null, speed: 0, evt: null }; }
  g.fireCd = Math.max(0, g.fireCd - dt);
  const k = env.see ? env.see(g) : 0; let evt = null;
  g.seen = k > 0;
  if (k > 0) { g.meter = Math.min(1, g.meter + dt * k * T.spotRate * (alert || g.aware ? 3 : 1)); }
  else g.meter = Math.max(0, g.meter - dt * 0.4);
  if (k > 0 && g.meter >= 1) {
    if (g.state !== 'engage') { evt = 'spotted'; g.state = 'engage'; }
    g.aware = true; g.last = { x: env.px, z: env.pz }; g.lostT = 0;
  }
  if (g.state === 'engage') {
    if (k <= 0) { g.lostT += dt; if (g.lostT >= T.lose) { g.state = 'search'; g.searchT = T.searchS; evt = evt || 'lost'; } }
    const tgt = g.last || { x: env.px, z: env.pz }, d = Math.hypot(tgt.x - g.x, tgt.z - g.z);
    return { goal: tgt, speed: k > 0 && d < T.keep ? 0 : T.run, evt, face: k > 0 ? { x: env.px, z: env.pz } : null };
  }
  // the alert ladder pulls calm guards in
  if (alert && (g.state === 'patrol')) { g.state = lockedDown(A) && g.post ? 'post' : 'investigate'; g.aware = true; }
  if (lockedDown(A) && g.post && (g.state === 'investigate' || (g.state === 'search' && g.searchT <= 0))) g.state = 'post';
  if (g.state === 'investigate') {
    const tgt = A?.last || g.last; if (!tgt) { g.state = 'patrol'; return { goal: null, speed: 0, evt }; }
    if (Math.hypot(tgt.x - g.x, tgt.z - g.z) < 1.2) { g.state = 'search'; g.searchT = T.searchS; return { goal: null, speed: 0, evt }; }
    return { goal: tgt, speed: T.run, evt };
  }
  if (g.state === 'search') {
    g.searchT -= dt; g.yaw += dt * 1.8; // look around
    if (g.searchT <= 0) { evt = evt || 'searched'; if (lockedDown(A) && g.post) g.state = 'post'; else if (!alert) g.state = 'patrol'; else g.searchT = T.searchS; }
    return { goal: null, speed: 0, evt };
  }
  if (g.state === 'post') {
    const d = Math.hypot(g.post.x - g.x, g.post.z - g.z);
    return { goal: d > 0.8 ? g.post : null, speed: T.run, evt };
  }
  // patrol
  if (g.route.length < 2) return { goal: null, speed: 0, evt };
  const wp = g.route[g.wp];
  if (Math.hypot(wp.x - g.x, wp.z - g.z) < 0.6) { g.wait += dt; if (g.wait >= T.waitS) { g.wait = 0; g.wp = (g.wp + 1) % g.route.length; } return { goal: null, speed: 0, evt }; }
  return { goal: wp, speed: T.walk, evt };
}
// a shot / melee hit. Returns { down, silent } (silent = a melee takedown on a guard who never noticed you)
export function hitGuard(g, dmg, kind, from) {
  if (g.state === 'down') return { down: false, silent: false };
  if (kind === 'melee' && !g.aware && g.meter < 0.5) { g.hp = 0; g.state = 'down'; return { down: true, silent: true }; }
  g.hp -= dmg; g.aware = true; if (from) { g.last = { x: from.x, z: from.z }; }
  if (g.hp <= 0) { g.state = 'down'; return { down: true, silent: false }; }
  if (g.state !== 'engage') { g.state = 'engage'; g.meter = 1; g.lostT = 0; }
  return { down: false, silent: false };
}
// should this guard fire now? (engaged, can see you, in range, cooled down). Hit chance falls with distance.
export function fireDecision(g, d, rnd = Math.random) {
  if (g.state !== 'engage' || !g.seen || g.fireCd > 0 || d > g.T.fireRange) return null;
  g.fireCd = g.T.fireCd; const p = Math.max(0.15, 0.65 - d / 50);
  return { hit: rnd() < p, dmg: g.T.dmg, p };
}
