// Street racing core (v7.3 race track + track builder): pure data and maths, no three.js and no DOM,
// so it runs in node for the unit tests (tests/test-race-unit.mjs). race.js draws and drives it; trackbuilder.js edits it.
// Coordinates are surface metres (x east, z south). A heading/yaw follows surface.js: forward = (-sin yaw, -cos yaw).

export const RACE_KEY = 'ssx.race.v1';          // { best: {id: ms}, wins: {id: n}, runs: {id: n}, tracks: [custom tracks] }
export const GHOST_PREFIX = 'ssx.race.ghost.';   // + track id -> best-lap ghost samples
export const GATE_W = 14;                         // gate opening (m)
export const MIN_GATES = 3, MAX_GATES = 24, MAX_PROPS = 24, MIN_PAID_LEN = 250;
export const PROP_TYPES = { ramp: { name: 'Ramp', icon: '⛰' }, barrier: { name: 'Barrier', icon: '🧱' }, boost: { name: 'Boost pad', icon: '⚡' } };
export const BUY_IN = 20;

// ---------- presets (colony-local metres; resolved against world.colony at runtime) ----------
// Loops: gate 0 is the start/finish line. Sprints: start behind gate 0, finish at the last gate.
export const PRESETS = [
  { id: 'mars-rustbelt', world: 'Mars', name: 'Rust Belt Loop', loop: true, laps: 2, par: 44, anchor: 'colony', pit: true,
    rival: { name: 'Slag', kind: 'buggy' }, purse: 150,
    blurb: 'The Junction\u2019s night race. Nine gates round the colony fence, no rules past the floodlights.',
    gates: [[0, 78], [70, 72], [116, 12], [102, -68], [40, -116], [-50, -112], [-112, -56], [-118, 24], [-66, 80]], props: [] },
  { id: 'mars-gutter', world: 'Mars', name: 'Gutter Sprint', loop: true, laps: 3, par: 24, anchor: 'colony',
    rival: { name: 'Mags Oduya', kind: 'buggy' }, purse: 120,
    blurb: 'Short, mean and full of junk. Ramps, a boost strip and a chicane somebody built out of road barriers.',
    gates: [[-20, 92], [34, 88], [58, 120], [34, 152], [-16, 156], [-52, 124]],
    props: [{ t: 'boost', x: 8, z: 90, yaw: -Math.PI / 2 }, { t: 'ramp', x: 47, z: 104, yaw: -2.5 }, { t: 'barrier', x: 50, z: 139, yaw: 0.9 }, { t: 'barrier', x: 20, z: 155, yaw: 1.5 }, { t: 'ramp', x: -36, z: 141, yaw: 0.85 }] },
  { id: 'moon-crater', world: 'Moon', name: 'Crater Run', loop: true, laps: 2, par: 40, anchor: 'colony', pit: true,
    rival: { name: 'Kestrel', kind: 'hoverbike' }, purse: 150,
    blurb: 'Kestrel\u2019s home track, six gates round the crater rim. She doesn\u2019t lose here, and she doesn\u2019t like people who try.',
    gates: [[0, 35], [50, -40], [120, -20], [150, 50], [100, 120], [20, 100]], props: [] }
];

// v7 contact races (game.js QUESTS 'race' steps) become free-play sprints once they exist in the quest list
export function questSprints(quests) {
  const out = [];
  for (const q of quests || []) for (const s of q.steps || []) if (s.type === 'race' && Array.isArray(s.pts) && s.pts.length >= MIN_GATES) {
    out.push({ id: 'q-' + q.id, world: q.world, name: q.title, loop: false, laps: 1, par: Math.round((s.limit || 70) * 0.82), anchor: 'colony',
      rival: { name: q.contact || 'Rival', kind: q.world === 'Moon' ? 'hoverbike' : 'buggy' }, purse: 90, fromQuest: true,
      blurb: `${q.contact || 'A contact'}\u2019s ${s.pts.length}-gate sprint, open for side bets.`, gates: s.pts.map(p => [p[0], p[1]]), props: [] });
  }
  return out;
}

// world-space copy of a track: gates [{x,z,yaw}], props [{t,x,z,yaw}]
// blocked(x, z, r) (optional, e.g. world.collide): a gate whose centre sits inside a building/dome footprint is moved to the
// nearest clear spot, leaning to the inside of the turn (v7.5.3: Blue Lights' gate 4 was the centre of the Olympus Row dome)
export function resolveTrack(def, colony, blocked) {
  const ox = def.anchor === 'colony' ? (colony?.x || 0) : 0, oz = def.anchor === 'colony' ? (colony?.z || 0) : 0;
  const g = def.gates.map(p => Array.isArray(p) ? { x: p[0] + ox, z: p[1] + oz } : { x: p.x + ox, z: p.z + oz });
  if (blocked && !def.custom) clearGates(g, blocked, def.loop !== false);
  orientGates(g, def.loop !== false);
  const props = (def.props || []).map(p => ({ t: p.t, x: p.x + ox, z: p.z + oz, yaw: p.yaw || 0 }));
  return { ...def, loop: def.loop !== false, laps: def.loop === false ? 1 : clampI(def.laps || 2, 1, 9), gates: g, props, length: trackLength(g, def.loop !== false) };
}
export const GATE_CLEAR = 4;                      // a gate centre keeps this much room (m) from any solid footprint
export const GATE_ROOM = GATE_W / 2;              // v7.5.4: a MOVED gate wants its whole opening clear (Blue Lights P2 was still stuck at
                                                  // Gate 4/8: the 4 m nudge parked it in a pocket between two domes and a kiosk)
export function clearGates(g, blocked, loop = true, clear = GATE_CLEAR, room = GATE_ROOM) {
  const n = g.length;
  for (let i = 0; i < n; i++) {
    const p = g[i]; if (!blocked(p.x, p.z, clear)) continue;
    const a = g[loop ? (i - 1 + n) % n : Math.max(0, i - 1)], b = g[loop ? (i + 1) % n : Math.min(n - 1, i + 1)];
    // v7.5.4 (Collin, P2 stuck at Gate 4/8 again): the old "nearest free ring" pick parked gate 4 in a pocket between two domes,
    // one arch leg inside the Olympus Row dome, behind a building - drive at the arrow and you hit a wall. Now: free spots with the
    // whole opening clear (GATE_ROOM) come first, ranked by how little they bend the line a -> spot -> b, and the first one with a
    // straight drivable run from the gate before AND to the gate after wins. Old 4 m rule as the fallback.
    const best = pickSpot(p, a, b, blocked, room > clear ? [room, clear] : [clear]);
    if (best) { p.moved = { x: p.x, z: p.z }; p.x = Math.round(best.x * 10) / 10; p.z = Math.round(best.z * 10) / 10; }
  }
  return g;
}
// a straight run a -> b a car (radius LANE_R) can drive without touching a footprint
export const LANE_R = 2.5;
export function laneClear(a, b, blocked, r = LANE_R) {
  const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(L / 2));
  for (let i = 1; i < n; i++) { const t = i / n; if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, r)) return false; }
  return true;
}
function pickSpot(p, a, b, blocked, needs, maxR = 60) {
  for (const need of needs) {
    const c = [];
    for (let r = 1; r <= maxR; r += 1) for (let k = 0; k < 32; k++) {
      const an = k / 32 * Math.PI * 2, x = p.x + Math.cos(an) * r, z = p.z + Math.sin(an) * r;
      if (blocked(x, z, need)) continue;
      c.push({ x, z, sc: Math.hypot(x - a.x, z - a.z) + Math.hypot(b.x - x, b.z - z) + 0.25 * r });
    }
    if (!c.length) continue;
    c.sort((u, v) => u.sc - v.sc);
    for (let i = 0; i < Math.min(c.length, 400); i++) { const q = c[i]; if ((a === p || laneClear(a, q, blocked)) && (b === p || laneClear(q, b, blocked))) return q; }
    return c[0];
  }
  return null;
}
// footprint predicate for tests / node: solids [{x,z,r}|{x,z,box:[hx,hz]}] like world.js builds them
export function footprintBlocked(solids) {
  return (x, z, r = 0) => solids.some(s => s.box ? Math.abs(x - s.x) < s.box[0] + r && Math.abs(z - s.z) < s.box[1] + r : Math.hypot(x - s.x, z - s.z) < s.r + r);
}
export const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
export function orientGates(g, loop) {
  const n = g.length;
  for (let i = 0; i < n; i++) {
    const a = g[loop ? (i - 1 + n) % n : Math.max(0, i - 1)], b = g[loop ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let dx = b.x - a.x, dz = b.z - a.z; if (!loop && (i === 0 || i === n - 1)) { const c = g[i === 0 ? 1 : n - 2] || g[i]; dx = i === 0 ? c.x - g[i].x : g[i].x - c.x; dz = i === 0 ? c.z - g[i].z : g[i].z - c.z; }
    if (Math.hypot(dx, dz) < 1e-6) { dx = 0; dz = -1; }
    g[i].yaw = yawOf(dx, dz);
  }
  return g;
}
export function trackLength(g, loop = true) {
  let L = 0; for (let i = 1; i < g.length; i++) L += Math.hypot(g[i].x - g[i - 1].x, g[i].z - g[i - 1].z);
  if (loop && g.length > 2) L += Math.hypot(g[0].x - g[g.length - 1].x, g[0].z - g[g.length - 1].z);
  return L;
}

// gate crossing: did the move p0 -> p1 pass through gate g (opening w)? forgiving: also counts a near miss of the centre
export function crossedGate(g, p0, p1, w = GATE_W, slack = 1.6) {
  const fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), lx = Math.cos(g.yaw), lz = -Math.sin(g.yaw);
  const a0 = (p0.x - g.x) * fx + (p0.z - g.z) * fz, a1 = (p1.x - g.x) * fx + (p1.z - g.z) * fz;
  if (Math.hypot(p1.x - g.x, p1.z - g.z) < 3.2) return true;
  if ((a0 <= 0 && a1 > 0) || (a0 >= 0 && a1 < 0)) {
    const t = a0 === a1 ? 0 : a0 / (a0 - a1), cx = p0.x + (p1.x - p0.x) * t, cz = p0.z + (p1.z - p0.z) * t;
    return Math.abs((cx - g.x) * lx + (cz - g.z) * lz) <= w / 2 + slack;
  }
  return false;
}

// start grid: a few metres behind gate 0, facing it
export function startGrid(t, back = 7, side = 0) {
  const g = t.gates[0], fx = -Math.sin(g.yaw), fz = -Math.cos(g.yaw), lx = Math.cos(g.yaw), lz = -Math.sin(g.yaw);
  return { x: g.x - fx * back + lx * side, z: g.z - fz * back + lz * side, yaw: g.yaw };
}

// ---------- rival path: centripetal-ish Catmull-Rom through the gates, sampled by arc length ----------
export function buildPath(t, step = 2) {
  const g = t.gates, n = g.length, loop = t.loop, pts = [];
  const P = i => loop ? g[(i + n) % n] : g[Math.max(0, Math.min(n - 1, i))];
  const segs = loop ? n : n - 1, gateS = [0];
  const pre = loop ? null : startGrid(t, 7);
  if (pre) pts.push({ x: pre.x, z: pre.z });
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const L = Math.hypot(p2.x - p1.x, p2.z - p1.z), k = Math.max(2, Math.ceil(L / step));
    for (let j = 0; j < k; j++) { const u = j / k, u2 = u * u, u3 = u2 * u;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      pts.push({ x: cr(p0.x, p1.x, p2.x, p3.x), z: cr(p0.z, p1.z, p2.z, p3.z), gate: j === 0 ? i : undefined }); }
  }
  if (!loop) pts.push({ x: g[n - 1].x, z: g[n - 1].z, gate: n - 1 });
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  let total = s[s.length - 1]; if (loop) total += Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].z - pts[pts.length - 1].z);
  for (let i = 0; i < pts.length; i++) if (pts[i].gate !== undefined) gateS[pts[i].gate] = s[i];
  return { pts, s, total, gateS, loop };
}
export function pathAt(path, dist) {
  const { pts, s, total, loop } = path; let d = loop ? ((dist % total) + total) % total : Math.max(0, Math.min(total, dist));
  let lo = 0, hi = pts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (s[m] <= d) lo = m; else hi = m - 1; }
  const a = pts[lo], b = pts[lo + 1] || (loop ? pts[0] : pts[lo]), segL = (s[lo + 1] ?? total) - s[lo] || 1, u = Math.min(1, (d - s[lo]) / segL);
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, yaw: yawOf(b.x - a.x || 1e-6, b.z - a.z) };
}

// race progress in "gates" so player and rival compare: lap*n + gates passed + fraction toward the next one
export function playerProgress(t, lap, nextIdx, passed, pos) {
  const n = t.gates.length, g = t.gates[nextIdx], prev = passed > 0 ? t.gates[(nextIdx - 1 + n) % n] : (t.loop ? t.gates[0] : startGrid(t, 7));
  const seg = Math.hypot(g.x - prev.x, g.z - prev.z) || 1, d = Math.hypot(g.x - pos.x, g.z - pos.z);
  return lap * (t.loop ? n : 0) + passed + Math.max(0, Math.min(0.99, 1 - d / seg));
}
export function rivalProgress(t, path, dist) {
  const n = t.gates.length, per = path.total, lap = t.loop ? Math.floor(dist / per) : 0, d = t.loop ? dist - lap * per : Math.min(dist, per);
  const gs = path.gateS; let i = 0;
  // loops: the rival starts on gate 0 and its first target is gate 1, same as the player
  const order = t.loop ? [...gs.slice(1), per] : gs;
  while (i < order.length && d >= order[i]) i++;
  const a = i === 0 ? (t.loop ? 0 : 0) : order[i - 1], b = order[Math.min(i, order.length - 1)];
  const frac = b > a ? Math.min(0.99, (d - a) / (b - a)) : 0;
  return lap * (t.loop ? n : 0) + i + frac;
}

// ---------- money ----------
export function payout(t, { won, newBest, firstWin, custom, broke }) {
  if (custom && (t.length < MIN_PAID_LEN || t.gates.length < MIN_GATES)) return { credits: 0, xp: 0, note: 'Practice track (too short for a purse)' };
  let base = custom ? Math.min(100, Math.round(t.length * (t.loop ? t.laps : 1) / 20)) : (t.purse || 120);
  let cr = won ? base : 0, xp = won ? 25 : 8;
  if (newBest) { cr += custom ? 10 : 40; xp += 10; }
  if (won && firstWin && !custom) { cr += 100; xp += 40; }
  if (broke) cr = Math.round(cr / 2);
  return { credits: cr, xp, note: '' };
}

// ---------- storage ----------
const DEF = () => ({ v: 1, best: {}, wins: {}, runs: {}, tracks: [] });
export function loadRace(ls) { try { const o = JSON.parse(ls.getItem(RACE_KEY)); if (o && typeof o === 'object') return { ...DEF(), ...o, tracks: Array.isArray(o.tracks) ? o.tracks.filter(validTrack) : [] }; } catch (e) { /* ignore */ } return DEF(); }
export function saveRace(ls, d) { try { ls.setItem(RACE_KEY, JSON.stringify(d)); return true; } catch (e) { return false; } }
export function validTrack(t) {
  return !!t && typeof t === 'object' && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.world === 'string' && Array.isArray(t.gates) &&
    t.gates.length >= 2 && t.gates.length <= MAX_GATES && t.gates.every(p => Number.isFinite(p.x) && Number.isFinite(p.z)) &&
    (!t.props || (Array.isArray(t.props) && t.props.length <= MAX_PROPS && t.props.every(p => PROP_TYPES[p.t] && Number.isFinite(p.x) && Number.isFinite(p.z))));
}
export function cleanTrack(t) {
  const r1 = v => Math.round(v * 10) / 10;
  return { id: t.id, name: String(t.name || 'My track').slice(0, 28), world: t.world, custom: true, anchor: 'abs', loop: t.loop !== false, laps: t.loop === false ? 1 : clampI(t.laps || 2, 1, 9),
    par: Math.max(10, Math.round(t.par || 0) || Math.round(trackLength(t.gates, t.loop !== false) / 15)), rival: { name: 'Pit Viper', kind: t.world === 'Moon' ? 'hoverbike' : 'buggy' },
    gates: t.gates.slice(0, MAX_GATES).map(p => ({ x: r1(p.x), z: r1(p.z) })), props: (t.props || []).slice(0, MAX_PROPS).map(p => ({ t: p.t, x: r1(p.x), z: r1(p.z), yaw: Math.round((p.yaw || 0) * 100) / 100 })) };
}
// ghost: [t(ms), x, z, yaw] every ~100 ms, packed flat and rounded
export function packGhost(samples) { const out = []; for (const s of samples) out.push(Math.round(s[0]), Math.round(s[1] * 10) / 10, Math.round(s[2] * 10) / 10, Math.round(s[3] * 100) / 100); return out; }
export function ghostAt(flat, ms) {
  const n = flat.length / 4; if (n < 2) return null;
  let lo = 0, hi = n - 1; if (ms >= flat[hi * 4]) return { x: flat[hi * 4 + 1], z: flat[hi * 4 + 2], yaw: flat[hi * 4 + 3], done: true };
  while (lo < hi - 1) { const m = (lo + hi) >> 1; if (flat[m * 4] <= ms) lo = m; else hi = m; }
  const a = lo * 4, b = hi * 4, u = Math.max(0, Math.min(1, (ms - flat[a]) / ((flat[b] - flat[a]) || 1)));
  const dy = Math.atan2(Math.sin(flat[b + 3] - flat[a + 3]), Math.cos(flat[b + 3] - flat[a + 3]));
  return { x: flat[a + 1] + (flat[b + 1] - flat[a + 1]) * u, z: flat[a + 2] + (flat[b + 2] - flat[a + 2]) * u, yaw: flat[a + 3] + dy * u, done: false };
}
export function fmtTime(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '--:--.--';
  const m = Math.floor(ms / 60000), s = Math.floor(ms / 1000) % 60, c = Math.floor(ms / 10) % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}
export function clampI(v, a, b) { v = Math.round(+v || 0); return Math.max(a, Math.min(b, v)); }

// Race fixes (BUGS-v7.4 M1/M2). Prop frames: a prop's normal is f = (-sin yaw, -cos yaw) (the barrier's thin
// axis / the ramp's climb direction) and its tangent is l = (cos yaw, -sin yaw) (the barrier's long axis).
export const BARRIER = { half: 3, thick: 0.42, h: 1.1 };   // matches jersey(6, 1.1) in race.js
export const RAMP = { halfW: 3, halfL: 4, h: 1.9 };        // matches wedge(6, 8, 1.9) in race.js
const propFrame = p => { const fx = -Math.sin(p.yaw || 0), fz = -Math.cos(p.yaw || 0); return { fx, fz, lx: -fz, lz: fx }; };

// M2: barrier contact that slides instead of pinning. ent = { x, z, yaw?, speed? } (a car when speed is a number),
// r = its radius. Pushes the body out along the shallowest axis (sides or end caps) plus a small epsilon, removes the
// velocity component going into the barrier and keeps the tangential part (scaled by `keep`), turning the heading to
// match so the next frame doesn't drive straight back in. A near head-on hit slides toward the nearer end at
// `headOn` x speed instead of stopping dead. Returns null when there's no contact, else the new state.
export function barrierSlide(ent, p, r, { eps = 0.05, keep = 0.9, headOn = 0.35 } = {}) {
  const { fx, fz, lx, lz } = propFrame(p), dx = ent.x - p.x, dz = ent.z - p.z;
  const along = dx * fx + dz * fz, lat = dx * lx + dz * lz;
  const penN = BARRIER.thick + r - Math.abs(along), penL = BARRIER.half + r - Math.abs(lat);
  if (penN <= 0 || penL <= 0) return null;
  // outward contact normal n and its tangent t
  let nx, nz, push;
  if (penN <= penL) { const s = Math.sign(along) || 1; nx = fx * s; nz = fz * s; push = penN + eps; }
  else { const s = Math.sign(lat) || 1; nx = lx * s; nz = lz * s; push = penL + eps; }
  const out = { x: ent.x + nx * push, z: ent.z + nz * push, yaw: ent.yaw, speed: ent.speed, hit: false, impact: 0 };
  if (typeof ent.speed !== 'number' || !ent.speed) return out;
  const hx = -Math.sin(ent.yaw || 0), hz = -Math.cos(ent.yaw || 0), vx = hx * ent.speed, vz = hz * ent.speed;
  const vn = vx * nx + vz * nz; if (vn >= 0) return out;  // already moving away / along: just the push-out
  const sp = Math.abs(ent.speed); out.hit = true; out.impact = -vn;
  let tx = vx - vn * nx, tz = vz - vn * nz, tl = Math.hypot(tx, tz);
  if (tl < headOn * sp) { // near head-on: pick the tangent toward the nearer end (or the way the nose already leans)
    const ux = -nz, uz = nx; let side = Math.sign(tx * ux + tz * uz);
    if (penN <= penL && Math.abs(lat) > 0.3) side = Math.sign((dx * ux + dz * uz)) || side;
    side = side || 1; tl = headOn * sp; tx = ux * side * tl; tz = uz * side * tl;
  }
  const ns = tl * keep, dir = Math.sign(ent.speed);
  out.speed = dir * ns; out.yaw = Math.atan2(-tx * dir, -tz * dir);
  return out;
}

// M1: is the point (x, y, z) inside a race prop's solid (padded for the camera near plane)? gy = ground height under it.
export function propCamHit(p, x, y, z, gy, pad = 0.45) {
  if (p.t !== 'barrier' && p.t !== 'ramp') return false;
  const { fx, fz, lx, lz } = propFrame(p), dx = x - p.x, dz = z - p.z, along = dx * fx + dz * fz, lat = dx * lx + dz * lz, dy = y - gy;
  if (dy < -1) return false;
  if (p.t === 'barrier') return Math.abs(lat) < BARRIER.half + pad && Math.abs(along) < BARRIER.thick + pad && dy < BARRIER.h + pad;
  if (Math.abs(lat) > RAMP.halfW + pad || Math.abs(along) > RAMP.halfL + pad) return false;
  const top = RAMP.h * Math.min(1, Math.max(0, (along + RAMP.halfL) / (2 * RAMP.halfL)));
  return dy < top + pad;
}
