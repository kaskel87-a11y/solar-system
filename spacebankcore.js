// Cinder Vault, the orbital bank job (v7.5.82). Pure logic: no DOM, no three.js.
// Vectors are [x, y, z] in the Mars frame (origin = Mars centre, axes = world axes). The station
// stays put in that frame while Mars goes round the Sun. Fiction only. Rough language lives in LINES.
// This is the orbital job. The Mars First Junction Trust heist is a different, already-shipped surface job.

export const SAVE_KEY = 'ssx.spacebank.v1';
export const FIXER = 'Nix Calder';
export const BANK_NAME = 'Cinder Vault';
export const NIX = [24, 18]; // colony-relative metres, Ares spaceport side (clear of Gutter Pell's pad)
export const NIX_R = 14;

// Station sits on +Z, outside the smuggling lane (Phobos rides at R=58). Dock ring is sunward of the hull.
export const BANK = { pos: [0, 6, 120], r: 3.4, dock: [0, 6, 110], dockR: 9, hold: 1.05 };
export const HOME = 18; // Mars-frame distance that counts as back at your ship
export const BUOYS = [
  { id: 'cams', name: 'camera grid', pos: [14, 5, 108] },
  { id: 'shift', name: 'guard shift', pos: [-12, 9, 126] },
  { id: 'timer', name: 'vault timer', pos: [0, 16, 132] }
];
export const INTEL_R = 11;
// Two security cameras on the approach, short of the dock, so holding in the ring is not an automatic alarm.
// `rest` points across the lane. beamDir sweeps it.
export const CAMS = [
  { id: 'lane', name: 'lane camera', at: [18, 4, 58], rest: [-1, 0.04, 0.12] },
  { id: 'belly', name: 'belly camera', at: [-16, 6, 74], rest: [1, -0.04, 0.1] }
];
export const SCAN = { range: 28, half: 0.46, sweep: 0.75, rate: 0.48, fill: 1, decay: 0.42, rollCut: 0.5, rollGhost: 1.2 };
export const LOCK = {
  range: 20, fill: 2.2, decay: 0.75, rollCut: 0.62, rollGhost: 1.15, hit: 28, speed: 34, lose: 72, loseT: 2.8,
  wheelSpeed: 26, wheelLose: 50, wheelLoseT: 1.9, wheelHit: 16
};
export const DRILL = { rate: 0.62, decay: 0.12, heat: 0.7, cool: 0.85, limit: 18 };
export const ROLES = [
  { id: 'drill', name: 'Vex Okonkwo', title: 'Drill', cost: 400, crew: ['vee', 'dex'], blurb: 'Chews the outer door. More time on the dial.' },
  { id: 'hack', name: 'Sera Quill', title: 'Hacker', cost: 500, crew: ['soren'], blurb: 'Widens the notches and kills some of the noise.' },
  { id: 'wheel', name: 'Moss Rye', title: 'Wheel', cost: 450, crew: ['mags'], blurb: 'Shadow pilot. Cutters lose you sooner and hit softer.' }
];
export const PAY = { base: 2400, perCrew: 380, clean: 640, hot: 0.12 };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = a => Math.hypot(a[0], a[1], a[2]);
export const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const dist = (a, b) => len(sub(a, b));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export { add, sub };

export function inCone(pos, dir, p, range = SCAN.range, half = SCAN.half) {
  const v = sub(p, pos), l = len(v); if (l > range || l < 1e-6) return false;
  return dot(v, dir) / l >= Math.cos(half);
}
export function blocked(a, b, spheres) {
  const d = sub(b, a), L2 = dot(d, d) || 1e-9;
  for (const s of spheres) {
    const t = clamp(dot(sub(s.c, a), d) / L2, 0, 1), q = add(a, mul(d, t));
    if (dist(q, s.c) < s.r && t > 0.02 && t < 0.98) return true;
  }
  return false;
}
export function beamDir(rest, t, phase = 0) {
  const a = Math.sin(t * 0.5 + phase) * SCAN.sweep, c = Math.cos(a), s = Math.sin(a);
  const u = norm(rest);
  return norm([u[0] * c - u[2] * s, u[1], u[0] * s + u[2] * c]);
}
export function scanStep(s, dt, { seen, rolled = false }) {
  let v = s.v || 0, ghost = Math.max(0, (s.ghost || 0) - dt), dodged = false;
  if (rolled && v > 0) { v = Math.max(0, v - SCAN.rollCut); ghost = SCAN.rollGhost; dodged = true; }
  if (seen && ghost <= 0) v += dt * SCAN.rate; else v = Math.max(0, v - dt * SCAN.decay);
  return { v: Math.min(SCAN.fill, v), ghost, flagged: v >= SCAN.fill, dodged };
}
export function lockStep(s, dt, { d, rolled = false }) {
  let v = s.v || 0, ghost = Math.max(0, (s.ghost || 0) - dt), broke = false;
  if (rolled && v > 0) { v = Math.max(0, v - LOCK.rollCut * LOCK.fill); ghost = LOCK.rollGhost; broke = true; }
  if (d <= LOCK.range && ghost <= 0) v += dt; else v = Math.max(0, v - dt * LOCK.decay);
  const hit = v >= LOCK.fill;
  return { v: hit ? 0 : v, ghost: hit ? 0.7 : ghost, hit, broke };
}
export function chaseTune(hasWheel) {
  return hasWheel
    ? { speed: LOCK.wheelSpeed, lose: LOCK.wheelLose, loseT: LOCK.wheelLoseT, hit: LOCK.wheelHit }
    : { speed: LOCK.speed, lose: LOCK.lose, loseT: LOCK.loseT, hit: LOCK.hit };
}
export const cutterCount = mobile => (mobile ? 1 : 2);

export function freshDrill() { return { fill: 0, heat: 0, t: 0, hot: false, done: false, failed: false, alarm: false }; }
// Holding fills the drill and the heat. Heat trips the grid at 1. Letting go cools the heat faster than the bite decays,
// so a steady hold alarms and a pulse (hold, release, hold) finishes clean. limit is the whole attempt.
export function drillStep(s, dt, holding) {
  if (s.done || s.failed) return { ...s, alarm: false };
  let fill = s.fill || 0, heat = s.heat || 0, hot = !!s.hot;
  const t = (s.t || 0) + dt;
  if (holding) { fill += dt * DRILL.rate; heat += dt * DRILL.heat; }
  else { fill = Math.max(0, fill - dt * DRILL.decay); heat = Math.max(0, heat - dt * DRILL.cool); }
  const alarm = !hot && heat >= 1;
  if (alarm) hot = true;
  fill = Math.min(1, fill); heat = Math.min(1.2, heat);
  const done = fill >= 1, failed = !done && t >= DRILL.limit;
  return { fill, heat, t, hot, done, failed, alarm };
}
// One skilled pass: short holds with a cool-off between them. Returns the finished drill state.
export function pulseDrill(s = freshDrill()) {
  let cur = { ...freshDrill(), ...s };
  for (let i = 0; i < 16 && !cur.done && !cur.failed; i++) {
    cur = drillStep(cur, 0.45, true);
    if (cur.done || cur.alarm || cur.failed) break;
    cur = drillStep(cur, 0.4, false);
  }
  return cur;
}

export function nearBuoy(p, buoy) { return !!p && dist(p, buoy.pos) <= INTEL_R; }
// The next buoy you have not logged. With a ship position, the nearest one. Without, the first.
export function nextBuoy(have, p) {
  const left = BUOYS.filter(b => !(have || []).includes(b.id));
  if (!left.length) return null;
  if (!p) return left[0];
  let best = left[0], bd = dist(p, best.pos);
  for (let i = 1; i < left.length; i++) { const d = dist(p, left[i].pos); if (d < bd) { best = left[i]; bd = d; } }
  return best;
}
export function fmtRange(d) {
  if (!Number.isFinite(d) || d < 0) return '';
  if (d >= 1000) return (d / 1000).toFixed(d >= 10000 ? 0 : 1) + ' km';
  return Math.round(d) + ' m';
}
// Screen point for a guide arrow. nx, ny are NDC (y up), already flipped if the target is behind the camera.
// The point stays outside the middle half of the screen, below the top bar and above the thumb row.
export function edgePointer(nx, ny, W, H) {
  let x = Number.isFinite(nx) ? nx : 0, y = Number.isFinite(ny) ? ny : 1;
  const ang = Math.atan2(x, y);
  const ax = Math.abs(x), ay = Math.abs(y);
  if (ax < 0.5 && ay < 0.5) { if (ax >= ay) x = (x < 0 ? -1 : 1) * 0.82; else y = (y < 0 ? -1 : 1) * 0.82; }
  x = Math.max(-0.92, Math.min(0.92, x));
  y = Math.max(-0.7, Math.min(0.9, y));
  let px = (x * 0.5 + 0.5) * W, py = (-y * 0.5 + 0.5) * H;
  const top = 62, bot = Math.min(H - 150, H * 0.78);
  px = Math.max(36, Math.min(W - 36, px));
  py = Math.max(top, Math.min(Math.max(top, bot), py));
  const L = W * 0.25, R = W * 0.75, T = H * 0.25, B = H * 0.75;
  if (px > L && px < R && py > T && py < B) {
    const dl = px - L, dr = R - px, dt = py - T, db = B - py, m = Math.min(dl, dr, dt, db);
    if (m === dl) px = L - 28; else if (m === dr) px = R + 28; else if (m === dt) py = Math.max(top, T - 28); else py = Math.min(Math.max(top, bot), B + 28);
  }
  return { x: px, y: py, ang };
}
// Plain words for the job card, plus where the arrow should aim. onGround means the ship is not flying in space yet.
export function guide(run, p, onGround) {
  if (!run) return null;
  const n = run.intel?.length | 0;
  if (run.phase === 'scout') {
    const b = nextBuoy(run.intel, onGround ? null : p);
    const count = `the 3 glowing buoys near Cinder Vault (${n}/3)`;
    return {
      kind: onGround ? 'takeoff' : 'buoy', hint: onGround ? 'Take off' : 'Buoy',
      label: onGround ? 'Cinder Vault' : (b?.name || 'buoy'),
      pos: onGround ? null : (b?.pos || null), id: b?.id || null,
      text: onGround ? `Take off and fly close to ${count}.` : `Fly close to ${count}. The arrow marks the next one.`
    };
  }
  if (run.phase === 'crew' || run.phase === 'vault') {
    return {
      kind: onGround ? 'takeoff' : 'dock', hint: onGround ? 'Take off' : 'Gold ring',
      label: 'Gold ring', pos: onGround ? null : BANK.dock, id: 'dock',
      text: onGround ? 'Take off and fly to the gold ring at Cinder Vault.' : 'Fly into the gold ring and hold still. The arrow points at it.'
    };
  }
  if (run.phase === 'drill') return { kind: null, hint: '', label: '', pos: null, id: null, text: 'Hold DRILL in pulses. A steady hold trips the heat.' };
  if (run.phase === 'crack') return { kind: null, hint: '', label: '', pos: null, id: null, text: 'The dial is up. Turn it slow.' };
  if (run.phase === 'getaway') {
    return {
      kind: 'mars', hint: 'Mars', label: 'Mars', pos: [0, 0, 0], id: 'mars',
      text: 'Cutters are up. Roll to break their lock. The arrow points at Mars. Dive for it.'
    };
  }
  return null;
}
export function gather(have, p) {
  const next = new Set(have || []);
  if (p) for (const b of BUOYS) if (dist(p, b.pos) <= INTEL_R) next.add(b.id);
  return [...next];
}

export function priceOf(roleId, hiredIds = []) {
  const role = ROLES.find(r => r.id === roleId); if (!role) return null;
  const who = role.crew.find(id => hiredIds.includes(id)) || null;
  return { id: role.id, name: role.name, title: role.title, blurb: role.blurb, cost: who ? 0 : role.cost, free: !!who, who };
}
export function vaultPlan(run) {
  const hack = !!run?.crew?.includes('hack'), drill = !!run?.crew?.includes('drill'), hot = !!run?.alarm;
  const tier = hot && !hack ? 'hard' : hack ? 'easy' : 'medium';
  const time = (hot ? 32 : 42) + (drill ? 14 : 0);
  return { tier, time, ease: hack ? 0.35 : 0 };
}
export function score(run, bonus = 0) {
  if (!run?.loot) return { cash: 0, stars: run ? 8 : 0 };
  let cash = PAY.base + PAY.perCrew * (run.crew?.length || 0);
  if (run.alarm) cash = Math.round(cash * (1 + PAY.hot));
  else cash += PAY.clean;
  const b = Math.max(0, +bonus || 0);
  cash = Math.round(cash * (1 + b) / 5) * 5;
  const stars = 35 + (run.crew?.length || 0) * 12 + (run.alarm ? 0 : 8);
  return { cash, stars };
}

export function newRun(seed = (Math.random() * 1e9) | 0) {
  return { phase: 'scout', intel: [], crew: [], alarm: false, heatSent: false, loot: false, hp: 100, retried: false, seed, dodges: 0, camHit: false };
}
export const PHASES = ['scout', 'crew', 'vault', 'drill', 'crack', 'getaway', 'done', 'failed'];

export function loadState(raw) {
  let o = null; try { o = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { o = null; }
  const n = (v, d = 0) => Number.isFinite(+v) ? +v : d;
  o = o && typeof o === 'object' ? o : {};
  return { v: 1, runs: n(o.runs), done: n(o.done), failed: n(o.failed), earned: n(o.earned) };
}

export const LINES = {
  start: [`${FIXER}: Cinder Vault. Orbital bank, not that Junction Trust clown show. Scout the buoys, buy a crew, drill the skin, crack the dial, burn home.`, `${FIXER}: Cameras on the approach. Don't sit in a cone. Take off and fly the +Z mast.`],
  intel: ['📡 Buoy logged.', '📡 Got it. Keep moving.'],
  intelDone: [`${FIXER}: That's the grid, the shift, and the timer. Hire a crew or fly it naked.`],
  crew: [`${FIXER}: Crew's set. Put the ship in the dock ring and hold.`],
  dock: ['🛟 Docked. Drill the skin. A steady hold trips the heat. Pulse it.', '🛟 Hard dock. Drill in pulses or the grid wakes up.'],
  alarm: ['🚨 You tripped the grid. Stars are waiting when you hit dirt.', '🚨 Alarm. Finish it and burn.'],
  dial: ['🔐 Skin\'s open. Work the dial. Slow hands.', '🔐 Dial\'s live. Don\'t rush the notches.'],
  blown: ['🔐 Too loud. Vault\'s blown. Run, there\'s no cut.', '🔐 Second miss. Get off the station.'],
  retry: ['🔐 Too much noise. One more try on the drill.', '🔐 Dial ate it. Drill it again.'],
  escape: ['🚨 Cutters off the mast. Roll the lock and dive for Mars.', '🚨 They\'re on you. Break the lock and get home.'],
  lost: ['🛰 Cutters gave up. Keep the nose on Mars.'],
  hit: ['💥 Cutter tagged the hull.', '💥 Taking fire. Don\'t let them board you.'],
  seized: [`${FIXER}: Boarded. The vault's still up there and you're broke.`],
  paid: [`${FIXER} wires the cut. Don't spend it all on bail.`, `${FIXER}: Money's in. Lie low.`]
};
export const line = (k, i = 0) => { const a = LINES[k] || ['']; return a[Math.abs(i | 0) % a.length]; };
