// Mars street circuits (Pumpkin add-on, pure data + maths, no THREE/DOM; unit-tested by tests/test-marstracks-unit.mjs).
// Five preset races for race.js (Chief of Staff's v7.4 race + track builder) laid out on the v7.5 city: one street circuit per
// district plus the Ares Beltway Run. Gates are colony-relative (anchor 'colony', like race.js's own presets) and follow the
// roads: the circuits ride the ring streets this add-on paints round each district, the Beltway Run rides the highway.
// Every path was checked against the city's blocks, domes, lots, parked vehicles and checkpoint booths (see the unit test).
// Also here: the road network used to snap builder placements onto roads, and the rival pace for car-meet circuit races.
import { resolveTrack, buildPath, yawOf, GATE_CLEAR } from './racecore.js';

export const WORLD = 'Mars';
export const ROAD_W = 8;          // painted street width (m); the Beltway itself is 10
export const SNAP_R = 36;         // a builder tap within this many metres of a road centreline snaps onto it
export const SNAP_TOOLS = { gate: true, ramp: true, boost: true }; // barriers stay where you put them (chicanes)
export const CORES = { aj: 56, district: 50 }; // world.js leaves the Beltway asphalt out of these site cores

// district origins, colony-relative (citydata.js)
export const DISTRICTS = {
  aj: { name: 'Ares Junction', at: [0, 0] }, downtown: { name: 'Olympus Row', at: [0, -430] },
  rough: { name: 'Red Tape Flats', at: [-280, -40] }, gated: { name: 'Helios Heights', at: [320, 80] }
};

const AJ_RING = [[-63.9, -6.7], [-58, -33.5], [-37.8, -52], [-12.4, -58.5], [12.4, -58.5], [37.8, -52], [58, -33.5], [63.9, -6.7], [56.8, 18.5], [44.4, 40], [26.1, 58.7], [0, 67], [-26.1, 58.7], [-44.4, 40], [-56.8, 18.5]];
const FLATS_RING = [[-226.7, -14.7], [-243.6, 5.2], [-266.3, 18.4], [-293.8, 22], [-320.8, 11.7], [-338.7, -11.4], [-342.3, -39.7], [-333.3, -65.3], [-316.4, -85.2], [-293.7, -98.4], [-266.2, -102], [-239.2, -91.7], [-221.3, -68.6], [-217.7, -40.3]];
const PRECINCT = [[-30, -382], [-10, -386], [-8, -408], [-20, -426], [-32, -446], [-44, -458], [-58, -460], [-63, -440], [-60, -418], [-48, -398]];
const CRESCENT = [[271.7, 29.3], [257.8, 47.9], [250.7, 70], [251.3, 93.2], [260, 116], [282, 118], [304, 116], [322, 104], [338, 92], [366, 92], [384, 86], [386.2, 57.1], [375, 36.7], [357.8, 21.1], [336.5, 12], [313.3, 10.3], [290.9, 16.3]];
const BELTWAY = [[-15, -135], [-4.3, -195.4], [0, -244], [0, -362], [48.1, -381.9], [68, -430], [120, -315], [190, -176], [250, -32], [258, 10], [257.8, 47.9], [250.7, 70], [251.3, 107.5], [120, 160], [80, 40], [0, 60], [-140, 20], [-221, -24], [-217.7, -40.3], [-221.3, -68.6], [-200, -120], [-80, -160], [-40, -107.5]];

// streets this add-on paints (colony-relative Catmull-Rom control points). Loops are the district ring roads; the link runs
// from the Beltway's south approach round the east side of Olympus Row to where the Beltway leaves for Helios; the slip road
// lets the Beltway Run skirt the Helios private gate.
export const STREETS = [
  { id: 'junction-ring', name: 'Junction Ring', loop: true, pts: AJ_RING },
  { id: 'precinct-loop', name: 'Precinct Loop', loop: true, pts: PRECINCT },
  { id: 'flats-ring', name: 'Flats Ring Road', loop: true, pts: FLATS_RING },
  { id: 'helios-crescent', name: 'Helios Crescent', loop: true, pts: CRESCENT },
  { id: 'olympus-link', name: 'Olympus Link', loop: false, pts: [[0, -340], [0, -362], [48.1, -381.9], [68, -430]] },
  { id: 'helios-slip', name: 'Helios Slip Road', loop: false, pts: [[240, -56], [250, -32], [258, 10], [257.8, 47.9]] } // skirts the Helios gate
];

// rival pace on street circuits (m/s along the racing line); par = path length / pace (race.js: rival pace = path.total / par)
const PACE = { street: 15, beltway: 20 };
// boost pad a fraction t along leg i -> i+1, facing along the leg
function pad(g, i, t = 0.5) { const a = g[i], b = g[(i + 1) % g.length]; return { t: 'boost', x: +(a[0] + (b[0] - a[0]) * t).toFixed(1), z: +(a[1] + (b[1] - a[1]) * t).toFixed(1), yaw: +yawOf(b[0] - a[0], b[1] - a[1]).toFixed(2) }; }
function preset(o) { const d = { world: WORLD, anchor: 'colony', loop: true, laps: 2, ...o, marsStreet: true }; d.par = Math.round(pathLen(d) / o.pace); delete d.pace; return d; }
export function pathLen(def) { return buildPath(resolveTrack(def, { x: 0, z: 0 })).total; }

export const MARS_PRESETS = [
  preset({ id: 'mars-st-junction', district: 'aj', name: 'Junction Ring', laps: 3, pace: PACE.street, rival: { name: 'Slag', kind: 'buggy' }, purse: 160,
    blurb: 'Three laps of the ring road round the Junction fence. Floodlights, haulers parked on the kerb and nowhere to hide.', gates: AJ_RING, props: [pad(AJ_RING, 3)] }),
  preset({ id: 'mars-st-olympus', district: 'downtown', name: 'Precinct Loop', laps: 3, pace: PACE.street - 2, rival: { name: 'Officer Dray (off duty)', kind: 'buggy' }, purse: 170,
    blurb: 'Tight streets on the west side of Olympus Row, right past the precinct. Ten gates, three laps, a lot of brake.', gates: PRECINCT, props: [pad(PRECINCT, 1)] }),
  preset({ id: 'mars-st-flats', district: 'rough', name: 'Red Tape Scramble', laps: 2, pace: PACE.street, rival: { name: 'Mags Oduya', kind: 'buggy' }, purse: 180,
    blurb: 'The Flats ring road, the long way round the shanty blocks. Starts outside the Saltblood toll. Don’t stop there.', gates: FLATS_RING, props: [pad(FLATS_RING, 6), pad(FLATS_RING, 12)] }),
  preset({ id: 'mars-st-helios', district: 'gated', name: 'Helios Crescent', laps: 2, pace: PACE.street, rival: { name: 'Kestrel', kind: 'hoverbike' }, purse: 220,
    blurb: 'Round the private estates on Helios Heights. Smooth tarmac, rich people’s cameras on every corner.', gates: CRESCENT, props: [pad(CRESCENT, 5), pad(CRESCENT, 13)] }),
  preset({ id: 'mars-st-beltway', district: 'highway', name: 'Ares Beltway Run', laps: 1, pace: PACE.beltway, rival: { name: 'Nix Calder', kind: 'buggy' }, purse: 400, pit: true,
    blurb: 'One lap of the whole Ares Beltway: Olympus hairpin, Helios, the Flats and back. Clean drivers get waved through the two ColSec checkpoints. Wanted ones don’t.',
    gates: BELTWAY, props: [pad(BELTWAY, 2, 0.4), pad(BELTWAY, 7, 0.5), pad(BELTWAY, 15, 0.5), pad(BELTWAY, 20, 0.5)] })
];

// ---------- road network (world coordinates) ----------
// Catmull-Rom like racecore.buildPath, sampled every ~step metres
export function sampleStreet(pts, loop, step = 3) {
  const n = pts.length, out = [], P = i => loop ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  const segs = loop ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), k = Math.max(2, Math.ceil(L / step));
    for (let j = 0; j < k; j++) { const u = j / k, u2 = u * u, u3 = u2 * u, cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      out.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]); }
  }
  if (loop) out.push(out[0].slice()); else out.push(pts[n - 1].slice());
  return out;
}
// segments [{ax,az,bx,bz,road}] from the painted streets + the Beltway (sampled with highway.at(s), skipping site cores where
// world.js draws no asphalt). colony {x,z}; highway = world.highway() or null; sites [{x,z,core}] world-space.
export function roadNetwork(colony, highway = null, sites = []) {
  const ox = colony?.x || 0, oz = colony?.z || 0, segs = [];
  for (const st of STREETS) { const s = sampleStreet(st.pts, st.loop); for (let i = 1; i < s.length; i++) segs.push({ ax: s[i - 1][0] + ox, az: s[i - 1][1] + oz, bx: s[i][0] + ox, bz: s[i][1] + oz, road: st.id }); }
  if (highway && highway.len > 0 && typeof highway.at === 'function') {
    const inCore = (x, z) => sites.some(c => Math.hypot(x - c.x, z - c.z) < c.core);
    let prev = null; const n = Math.ceil(highway.len / 4);
    for (let i = 0; i <= n; i++) { const p = highway.at(Math.min(highway.len - 0.01, i * highway.len / n)), ok = p && !inCore(p.x, p.z);
      if (ok && prev) segs.push({ ax: prev.x, az: prev.z, bx: p.x, bz: p.z, road: 'beltway' }); prev = ok ? p : null; }
  }
  return segs;
}
// nearest point on the network within maxD (null if none)
export function snapPoint(segs, x, z, maxD = SNAP_R) {
  let best = null, bd = maxD * maxD;
  for (const s of segs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L2 = dx * dx + dz * dz || 1e-9, t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / L2));
    const px = s.ax + dx * t, pz = s.az + dz * t, d2 = (px - x) ** 2 + (pz - z) ** 2;
    if (d2 < bd) { bd = d2; best = { x: px, z: pz, d: Math.sqrt(d2), road: s.road }; }
  }
  return best;
}

// ---------- car-meet circuit races ----------
export const MEET_WAGERS = [0, 50, 100, 250, 500];
// how fast an NPC meet car lapses a track: a share of its boost top speed, more on long straights than in tight streets
export function meetPace(spec, track, skill = 1) {
  const g = track.gates, n = g.length; let L = 0; for (let i = 1; i < n; i++) L += Math.hypot(g[i].x - g[i - 1].x, g[i].z - g[i - 1].z);
  const avgLeg = n > 1 ? L / (n - 1) : 50, share = Math.max(0.48, Math.min(0.62, 0.48 + avgLeg / 1000));
  return (spec?.boost ?? (spec?.vmax || 17) * 1.5) * share * skill;
}
// race.js def for a meet circuit on a (world-space, resolved) track against a meet car; purse = both stakes + 30 + distance money
export function meetCircuitDef(src, car, wager = 0) {
  const t = src.gates[0] && src.gates[0].yaw !== undefined ? src : resolveTrack(src, { x: 0, z: 0 });
  const total = buildPath(t).total, pace = meetPace(car.spec, t, car.skill || 1), laps = t.loop ? t.laps : 1;
  return { id: 'meet-c-' + src.id, world: src.world, name: `${src.name} · ${car.name}`, loop: t.loop, laps, anchor: 'abs', meet: true,
    gates: t.gates.map(g => ({ x: g.x, z: g.z })), props: (t.props || []).map(p => ({ ...p })), rival: { name: car.name, kind: car.kind },
    par: Math.max(8, Math.round(total / pace * 10) / 10), purse: wager * 2 + 30 + Math.min(150, Math.round(total * laps / 25)), blurb: 'Car meet circuit race.' };
}
// rep for a circuit (a bit more than a drag: it’s longer and riskier)
export const circuitRep = (won, wager, tier = 1, laps = 1) => won ? 8 + Math.round(wager / 25) + tier * 2 + Math.min(4, laps) : 2;

// ---------- checkpoint sanity (no gates inside buildings/interiors or off the drivable surface) ----------
// check(x, z) -> null when a car can sit there, else a reason ('building', 'steep', 'offroad', ...). The runtime builds it from
// world.solidAt + the terrain height; the unit test from the city footprints. Gates use a small ring so a gate can't straddle a wall.
export const GATE_RING = GATE_CLEAR; // v7.5.4: same clearance as racecore.clearGates (#31), one rule for every gate (m of clear ground round a gate centre)
export const MAX_SLOPE = 0.55;  // rise/run (~29°) the rovers can still hold a line on
export function gateIssue(x, z, check, ring = GATE_RING) {
  const c = check(x, z); if (c) return c;
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = check(x + Math.cos(a) * ring, z + Math.sin(a) * ring); if (r) return r; }
  return null;
}
// road points near (x, z), nearest first: every `step` metres along any road segment within maxD
export function roadCandidates(segs, x, z, maxD = SNAP_R, step = 2) {
  const out = [];
  for (const s of segs) {
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz) || 1e-9, n = Math.max(1, Math.ceil(L / step));
    for (let i = 0; i <= n; i++) { const px = s.ax + dx * i / n, pz = s.az + dz * i / n, d = Math.hypot(px - x, pz - z); if (d <= maxD) out.push({ x: px, z: pz, d, road: s.road }); }
  }
  return out.sort((a, b) => a.d - b.d);
}
// where a bad gate should go: the nearest clear road point (within maxD), else the nearest clear ground on a spiral, else null.
// accept(c) can veto a spot (sanitizeGates uses it so the legs in and out of the moved gate are drivable too).
export function moveGate(x, z, check, segs = [], maxD = 24, accept = null) {
  const okAt = c => !gateIssue(c.x, c.z, check) && (!accept || accept(c));
  for (const c of roadCandidates(segs, x, z, maxD)) if (okAt(c)) return { x: c.x, z: c.z, d: c.d, road: c.road };
  for (let r = 2; r <= maxD; r += 2) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, c = { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r }; if (okAt(c)) return { ...c, d: r, road: null }; }
  return null;
}
// racing line from gate i-1 to gate i (the same uniform Catmull-Rom racecore.buildPath draws), `step` m apart
export function legPoints(gates, i, loop = true, step = 2) {
  const n = gates.length, P = j => { const g = gates[loop ? (j + n) % n : Math.max(0, Math.min(n - 1, j))]; return Array.isArray(g) ? { x: g[0], z: g[1] } : g; };
  const p0 = P(i - 2), p1 = P(i - 1), p2 = P(i), p3 = P(i + 1), L = Math.hypot(p2.x - p1.x, p2.z - p1.z), m = Math.max(2, Math.ceil(L / step)), out = [];
  for (let k = 0; k <= m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
    out.push({ x: f(p0.x, p1.x, p2.x, p3.x), z: f(p0.z, p1.z, p2.z, p3.z) }); }
  return out;
}
// can gate i be driven to from gate i-1? first blocked point on that leg, or null
export function legBlock(gates, i, check, loop = true) { for (const q of legPoints(gates, i, loop)) { const r = check(q.x, q.z); if (r) return { x: q.x, z: q.z, why: r }; } return null; }
// gates: [{x,z,...}] world. Moves each bad gate (and any gate whose leg in is blocked, once) to clear road; drops what can't move.
// legCheck (default: check) judges the racing line between gates; it can be looser (corners cut off the centreline are fine).
export function sanitizeGates(gates, check, segs = [], { loop = true, minGates = 3, legCheck = check } = {}) {
  const out = [], moved = [], dropped = [];
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i], why = gateIssue(g.x, g.z, check);
    if (!why) { out.push(g); continue; }
    const n = gates.length, P = j => loop ? gates[(j + n) % n] : gates[Math.max(0, Math.min(n - 1, j))], prev = out.length ? out[out.length - 1] : P(i - 1);
    const accept = c => { const a = [P(i - 2), prev, c, P(i + 1), P(i + 2)]; return (!loop && i === 0 || !legBlock(a, 2, legCheck, false)) && (!loop && i === n - 1 || !legBlock(a, 3, legCheck, false)); };
    const m = moveGate(g.x, g.z, check, segs, 24, accept);
    if (m) { out.push({ ...g, x: m.x, z: m.z }); moved.push({ i, why, from: [g.x, g.z], to: [m.x, m.z] }); } else dropped.push({ i, why, at: [g.x, g.z] });
  }
  if (out.length < minGates) return { gates: gates.slice(), moved: [], dropped, ok: false };
  const blocked = []; for (let i = loop ? 0 : 1; i < out.length; i++) { const b = legBlock(out, i, legCheck, loop); if (b) blocked.push({ i, ...b }); }
  return { gates: out, moved, dropped, blocked, ok: !blocked.length };
}
// builder tap: snap on -> nearest clear road point within SNAP_R; a tap inside a building (or on ground too steep) is moved to
// clear road/ground nearby, or rejected. Returns { x, z, road?, moved? }, { reject: why } or null (keep the tap point as is).
export function snapTap(segs, x, z, check, snap = true) {
  const why = check ? gateIssue(x, z, check) : null;
  if (snap) for (const c of roadCandidates(segs, x, z, SNAP_R)) if (!check || !gateIssue(c.x, c.z, check)) return { x: c.x, z: c.z, d: c.d, road: c.road, moved: !!why };
  if (!why) return null;
  const m = moveGate(x, z, check, [], 12); return m ? { x: m.x, z: m.z, d: m.d, road: null, moved: true, why } : { reject: why };
}
