// Heist mechanics: pure logic (no DOM, no three.js), so it unit-tests in node. heist.js / safecrack.js / cameras.js
// wrap it with UI and world hooks. Angles in degrees for the safe dial, radians for cameras (world.js convention:
// yaw 0 looks toward -z, x east, z south).

// ---------- seeded rng ----------
export function rng(seed = 1) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const wrap180 = a => ((a % 360) + 540) % 360 - 180;

// ---------- safe-crack ----------
// Turn the dial; each tumbler has a hidden notch. Near it the dial "talks" (feedback 0..1 rises, phone buzzes);
// hold still inside the notch for `hold` seconds to set it. Spinning fast makes noise; noise >= 1 trips the alarm.
export const SAFE_TIERS = {
  easy:   { tumblers: 2, tol: 14, hold: 0.45, time: 45, noiseRate: 0.35, quietDps: 420, hint: 60 },
  medium: { tumblers: 3, tol: 10, hold: 0.55, time: 40, noiseRate: 0.5,  quietDps: 360, hint: 50 },
  hard:   { tumblers: 4, tol: 7,  hold: 0.65, time: 40, noiseRate: 0.7,  quietDps: 300, hint: 40 },
  vault:  { tumblers: 5, tol: 6,  hold: 0.7,  time: 50, noiseRate: 0.85, quietDps: 260, hint: 36 }
};
export function createSafe(opts = {}) {
  const tier = SAFE_TIERS[opts.tier] ? opts.tier : 'medium';
  const T = { ...SAFE_TIERS[tier], ...(opts.overrides || {}) };
  if (opts.time) T.time = opts.time;
  const r = rng(opts.seed ?? 7);
  const targets = []; let prev = 0;
  for (let i = 0; i < T.tumblers; i++) { // each notch at least 70 degrees from the last so it's a real turn
    let t; do { t = Math.round(r() * 360 - 180); } while (Math.abs(wrap180(t - prev)) < 70); targets.push(t); prev = t;
  }
  const s = { tier, cfg: T, targets, idx: 0, angle: 0, held: 0, noise: 0, t: 0, done: false, result: null, feedback: 0, inZone: false, set: [] };
  function finish(success, reason) { if (s.done) return; s.done = true; s.result = { success, reason, time: +s.t.toFixed(2), noise: +s.noise.toFixed(2), tier, tumblers: s.idx }; }
  // dAngle: degrees turned this frame (signed). Returns the state.
  s.step = (dt, dAngle = 0) => {
    if (s.done || dt <= 0) return s;
    s.t += dt; s.angle = wrap180(s.angle + dAngle);
    const dps = Math.abs(dAngle) / dt;
    if (dps > T.quietDps) s.noise += T.noiseRate * dt * Math.min(4, dps / T.quietDps);
    else s.noise = Math.max(0, s.noise - dt * 0.08);
    const diff = Math.abs(wrap180(s.angle - targets[s.idx]));
    s.feedback = diff >= T.hint ? 0 : 1 - diff / T.hint;
    s.inZone = diff <= T.tol;
    if (s.inZone && dps < T.quietDps * 0.5) { s.held += dt; if (s.held >= T.hold) { s.set.push(targets[s.idx]); s.idx++; s.held = 0; if (s.idx >= targets.length) finish(true, 'cracked'); } }
    else s.held = Math.max(0, s.held - dt * 2);
    if (!s.done && s.noise >= 1) finish(false, 'noise');
    if (!s.done && s.t >= T.time) finish(false, 'timeout');
    return s;
  };
  s.abort = () => finish(false, 'abort');
  s.view = () => ({ tier, angle: s.angle, idx: s.idx, total: targets.length, held: s.held / T.hold, noise: Math.min(1, s.noise), left: Math.max(0, T.time - s.t), feedback: s.feedback, inZone: s.inZone, done: s.done });
  return s;
}

// ---------- cameras ----------
// def: { id, x, z, yaw, fov (deg, default 70), range (m, 14), sweep (deg half-arc, 0 = fixed), sweepSpeed (rad/s, 0.6), level (wanted, 2) }
export function normCamera(def) {
  return { id: def.id, x: +def.x, z: +def.z, y: def.y ?? 3, yaw0: def.yaw ?? 0, yaw: def.yaw ?? 0, fov: (def.fov ?? 70) * Math.PI / 180, range: def.range ?? 14,
    sweep: (def.sweep ?? 35) * Math.PI / 180, sweepSpeed: def.sweepSpeed ?? 0.6, level: def.level ?? 2, meter: 0, phase: def.phase ?? 0,
    disabledFor: 0, alerted: false, cooldown: 0, heistId: def.heistId || null, label: def.label || null };
}
// facing vector for yaw (world.js: yaw 0 looks toward -z)
export const facing = yaw => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });
export function inCone(cam, px, pz) {
  const dx = px - cam.x, dz = pz - cam.z, d = Math.hypot(dx, dz);
  if (d > cam.range) return 0; if (d < 0.8) return 1;
  const f = facing(cam.yaw), cos = (dx * f.x + dz * f.z) / d;
  if (cos < Math.cos(cam.fov / 2)) return 0;
  return 1 - d / cam.range * 0.6; // closer = faster detection (0.4..1)
}
// advance one camera; target = { x, z, hidden (indoors/ducking), speed, see?(cam) -> bool line of sight }. Returns 'alert' on the frame the meter fills.
export function stepCamera(cam, dt, target, time) {
  cam.yaw = cam.yaw0 + (cam.sweep ? Math.sin(time * cam.sweepSpeed + cam.phase) * cam.sweep : 0);
  if (cam.cooldown > 0) cam.cooldown -= dt;
  if (cam.disabledFor > 0) { cam.disabledFor = Math.max(0, cam.disabledFor - dt); cam.meter = Math.max(0, cam.meter - dt); return null; }
  let k = target && !target.hidden ? inCone(cam, target.x, target.z) : 0;
  if (k > 0 && target.see && !target.see(cam)) k = 0; // v7.5.4: line of sight (walls / buildings block the cone), see heistlos.js
  if (k > 0) cam.meter = Math.min(1, cam.meter + dt * k * (0.9 + Math.min(1.5, (target.speed || 0) / 6)));
  else cam.meter = Math.max(0, cam.meter - dt * 0.35);
  if (cam.meter >= 1 && !cam.alerted && cam.cooldown <= 0) { cam.alerted = true; cam.cooldown = 8; return 'alert'; }
  if (cam.meter <= 0.05) cam.alerted = false;
  return k > 0 ? 'seeing' : null;
}

// ---------- alarm ----------
// What the world should do when an alarm of `level` fires while the player has `wanted` stars.
// Returns { op: 'setWanted'|'crime'|'none', n }. setWanted when the alarm is hotter than the current heat;
// once you're already at/above it, crime(level) bumps one star (world.crime: max(wanted + 1, min)) unless capped.
export function alarmAction(level, wanted, { escalate = true, cap = 5 } = {}) {
  level = Math.max(0, Math.min(cap, Math.round(level)));
  if (level <= 0) return { op: 'none', n: wanted };
  if (wanted < level) return { op: 'setWanted', n: level };
  if (escalate && wanted < cap) return { op: 'crime', n: Math.min(cap, wanted + 1) };
  return { op: 'none', n: wanted };
}

// ---------- heist flow ----------
export const STAGES = ['idle', 'case', 'breakin', 'crack', 'escape', 'clean', 'done', 'failed'];
const NEXT = { idle: 'case', case: 'breakin', breakin: 'crack', crack: 'escape', escape: 'clean', clean: 'done' };
// def (colony-relative or world coords, metres): { id, title, world, site:{x,z,r}, door:{x,z}, safe:{x,z,tier,time?},
//   cameras:[camera defs], alarm:{ wanted:2, responseS:18, failAt:null }, loot:{ credits, item }, escapeR }
export function validateHeist(def) {
  const errs = [];
  if (!def || typeof def !== 'object') return ['def must be an object'];
  if (!def.id) errs.push('id required');
  for (const k of ['site', 'door', 'safe']) if (!def[k] || !isFinite(def[k].x) || !isFinite(def[k].z)) errs.push(`${k}: { x, z } required`);
  if (def.safe && def.safe.tier && !SAFE_TIERS[def.safe.tier]) errs.push(`safe.tier must be one of ${Object.keys(SAFE_TIERS).join('/')}`);
  if (def.cameras && !Array.isArray(def.cameras)) errs.push('cameras must be an array');
  return errs;
}
export function normHeist(def) {
  const errs = validateHeist(def); if (errs.length) throw new Error('registerHeist: ' + errs.join('; '));
  return { world: 'Mars', title: def.id, cameras: [], loot: { credits: 300 }, ...def,
    site: { r: 20, ...def.site }, safe: { tier: 'medium', ...def.safe },
    alarm: { wanted: 2, responseS: 18, failAt: null, ...(def.alarm || {}) }, escapeR: def.escapeR ?? Math.max(30, (def.site.r ?? 20) + 12) };
}
export function createRun(def) {
  const run = { def, stage: 'case', t: 0, tBreak: null, alarm: false, alarmT: 0, responded: false, loot: null, log: [], fail: null };
  run.advance = (to) => { const want = to || NEXT[run.stage]; if (!want || run.stage === 'done' || run.stage === 'failed') return false;
    if (to && STAGES.indexOf(to) <= STAGES.indexOf(run.stage)) return false; run.log.push([run.stage, want, +run.t.toFixed(2)]); run.stage = want; return true; };
  run.failWith = (why) => { if (run.stage === 'done' || run.stage === 'failed') return false; run.fail = why; run.log.push([run.stage, 'failed', +run.t.toFixed(2)]); run.stage = 'failed'; return true; };
  return run;
}
// the escape-event payload contract (see README / PR body). Keep it flat and JSON-safe.
export function escapePayload(run, { x, z, wanted = 0, evading = false, security = 0, vehicle = null }) {
  const site = run.w?.site || run.def.site; // resolved world coords when the run has them
  return { id: run.def.id, title: run.def.title, world: run.def.world, pos: { x: +x.toFixed(2), z: +z.toFixed(2) },
    site: { x: +site.x.toFixed(2), z: +site.z.toFixed(2), r: run.def.site.r }, heat: wanted, evading: !!evading, security,
    alarm: !!run.alarm, loot: run.loot ? { ...run.loot } : null, t: +(run.tBreak == null ? 0 : run.t - run.tBreak).toFixed(2), vehicle };
}

// ---------- Steve's mars-city pack -> heist defs ----------
// mansion building from gated-community.json (uses at_aj / safe_at / camera_pts in district-local + origin_aj).
// Output coords are AJ-relative (= Mars colony-relative today), flagged rel:'colony'.
export function heistFromMansion(b, originAj, extra = {}) {
  const o = originAj || [0, 0], A = p => ({ x: p[0] + o[0], z: p[1] + o[1] });
  const key = (b.sign || b.title || 'mansion').toLowerCase().split(/\s+/)[0];
  const site = A(b.at), safe = A(b.safe_at || b.at);
  const door = b.door ? A(b.door) : { x: site.x, z: site.z + (b.r || 9) + 1 };
  const cams = (b.camera_pts || []).map((p, i) => { const c = A(p); return { id: `${key}-cam${i}`, x: c.x, z: c.z, yaw: Math.atan2(-(site.x - c.x), -(site.z - c.z)) + Math.PI, range: 12, fov: 70, sweep: 30, phase: i * 1.3, level: 2 }; });
  return { id: `heist-${key}`, title: b.title || b.sign, world: 'Mars', rel: 'colony', site: { ...site, r: (b.r || 9) + 8 }, door, safe: { ...safe, tier: extra.tier || 'medium' },
    cameras: cams, alarm: { wanted: 2, responseS: b.alarm_response_s ?? 18 }, loot: { credits: extra.credits ?? 300, item: 'contraband' }, ...extra };
}

// ---------- informant tips (Steve's barter.json 'heist_tip' entries, passed in by the informant) ----------
// { type:'cameras' } reveal camera spots/cones | { type:'safe', ease:0..0.6 } easier safe | { type:'patrol' } reveal guard spots
export const TIP_TYPES = ['cameras', 'safe', 'patrol'];
export function normTip(tip) {
  if (!tip || typeof tip !== 'object' || !TIP_TYPES.includes(tip.type)) return null; // unknown types are ignored safely
  if (tip.type === 'safe') { const e = Number(tip.ease); return { type: 'safe', ease: Math.min(0.6, Math.max(0, Number.isFinite(e) ? e : 0.25)) }; }
  return { type: tip.type };
}
// fold a heist's tips into safeCrack opts: ease widens the notch tolerance, lengthens hold-quiet speed and the timer
export function tipSafeOpts(tier, time, tips = {}) {
  const T = SAFE_TIERS[tier] || SAFE_TIERS.medium, e = tips.safeEase || 0;
  if (!e) return { time };
  return { time: Math.round((time || T.time) * (1 + e)), overrides: { tol: +(T.tol * (1 + e)).toFixed(2), quietDps: Math.round(T.quietDps * (1 + e * 0.5)) } };
}
export function applyTipTo(tips, tip) {
  const t = normTip(tip); if (!t) return null;
  if (t.type === 'cameras') tips.cameras = true;
  else if (t.type === 'patrol') tips.patrol = true;
  else tips.safeEase = Math.min(0.6, Math.max(tips.safeEase || 0, t.ease)); // tips don't stack past the best one
  return t;
}
