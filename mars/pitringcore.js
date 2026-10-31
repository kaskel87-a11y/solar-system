// v7.5.21 The Pit landmark: pure layout (no DOM, no three.js) shared by mars/pitring.js and tests/test-pit-unit.mjs.
// Everything is in metres relative to the Pit centre (PIT_LOCAL in the Flats district frame, +x east, +z south), so the
// test can check every prop against the fight radius, the district's building blocks, vehicle slots and the water tower.
export const PIT_LOCAL = [-40, -9];   // must match city.js PIT_LOCAL / act-pit-fight at_local (test checks)
export const FLATS_AJ = [-280, -40];  // Flats district origin, AJ-relative (citydata districts.rough)
export const FIGHT_R = 6;             // world.js duel ring (RingGeometry 5.6..6.0)
export const ROPE = 6.6;              // half-side of the square rope ring (posts at the corners)
export const MAT = 7.1;               // half-side of the stained mat (thin, under the duel ring decal)
export const POST_H = 1.75;
export const ROPES = [0.55, 0.95, 1.35]; // rope / chain strand heights
export const SAG = 0.12;              // mid-span sag of each strand
// Gantry: the sign frame (west) and a floodlight mast (east) carry a wire with a hanging lamp rig over the ring.
export const SIGN = { at: [-12.6, 0], legs: [[-12.6, -3.7], [-12.6, 3.7]], w: 9.4, h: 2.6, y: 5.4, yaw: Math.PI / 2, text: 'THE PIT' };
export const MAST = { at: [11.2, 0], h: 8.8 };
export const RIG_Y = 7.4;             // hanging lamp rig height above the mat
export const RIG = [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]; // lamp heads hanging from the rig
export const LAMP_HEADS = [[-12.6, -3.7, 8.6], [-12.6, 3.7, 8.6], [11.2, -0.6, 8.6], [11.2, 0.6, 8.6]]; // floods on the supports [x,z,y]
export const TOWER = { at: [2, 13], r: 3 }; // mars/dress.js PIT_TOWER [-38,4] relative to the Pit (test checks); the crowd keeps off it
export const POLE_R = 0.22;           // collider radius of sign legs / mast / posts
export const MINIMAP = { icon: '\u{1F94A}', color: '#f97316', r: 4 };
export const DRAW_R = 240;            // the landmark is hidden beyond this camera distance
export const ENTRY = { dir: 0, half: 0.64 }; // east gap in the crowd (radians around +x): walk or drive in from the Flats (car-sized clearance past the mast)

export const posts = () => [[-ROPE, -ROPE], [ROPE, -ROPE], [ROPE, ROPE], [-ROPE, ROPE]];
export const solids = () => [
  ...posts().map(([x, z]) => ({ x, z, r: 0.3, h: POST_H + 0.1, kind: 'post' })),
  ...SIGN.legs.map(([x, z]) => ({ x, z, r: POLE_R + 0.08, h: SIGN.y + SIGN.h + 1, kind: 'sign' })),
  { x: MAST.at[0], z: MAST.at[1], r: POLE_R + 0.08, h: MAST.h, kind: 'mast' },
];

// deterministic cheap hash for crowd variety
const hash = i => { let h = (i + 1) * 2654435761 >>> 0; h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13; return (h >>> 0) / 4294967296; };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };

// Candidate spectator spots: two staggered rows outside the corner posts, facing the centre, with the east entry left
// open and nothing within 1.1 m of a ring post / sign leg / mast. Runtime drops any that the world says are blocked.
export const CROWD_R = [10.3, 11.6];
export function crowdCandidates(phone = false) {
  const out = [], step = phone ? 0.36 : 0.25, S = solids();
  CROWD_R.forEach((R, row) => {
    for (let a = -Math.PI + (row ? step / 2 : 0); a < Math.PI - 1e-6; a += step) {
      if (angDiff(a, ENTRY.dir) < ENTRY.half) continue;
      const i = out.length + row * 97, j = hash(i) - 0.5, rr = R + j * 0.5, aa = a + (hash(i + 7) - 0.5) * step * 0.35;
      const x = Math.cos(aa) * rr, z = Math.sin(aa) * rr;
      if (angDiff(aa, ENTRY.dir) < ENTRY.half || S.some(s => Math.hypot(x - s.x, z - s.z) < s.r + 1.1) || Math.hypot(x - TOWER.at[0], z - TOWER.at[1]) < TOWER.r + 1.2) continue;
      out.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: Math.atan2(x, z), pose: hash(i + 3) < 0.5 ? 0 : 1, seed: hash(i + 11), row });
    }
  });
  return out;
}

// every ground footprint the landmark adds (posts, legs, mast, mat edge, crowd) for clearance checks
export function footprint(phone = false) {
  return [...solids(), ...crowdCandidates(phone).map(c => ({ x: c.x, z: c.z, r: 0.35, kind: 'crowd' }))];
}

// world position of the Pit centre for a colony at (cx, cz): AJ = colony + FLATS_AJ + PIT_LOCAL
export const centreWorld = (colony) => ({ x: (colony?.x || 0) + FLATS_AJ[0] + PIT_LOCAL[0], z: (colony?.z || 0) + FLATS_AJ[1] + PIT_LOCAL[1] });

// where to stand to start a fight: 1.6 m from the centre on the side the player is on, facing the centre, so the duel's
// midpoint lands on the Pit centre (world.challenge places the opponent 3.2 m along the facing direction)
export function startSpot(cx, cz, px, pz, half = 1.6) {
  let dx = px - cx, dz = pz - cz; const d = Math.hypot(dx, dz);
  if (d < 0.3) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
  const x = cx + dx * half, z = cz + dz * half;
  return { x, z, yaw: Math.atan2(dx, dz) }; // yaw convention: facing (fx,fz) -> atan2(-fx,-fz); facing = -d
}

// cheer amplitude 0..1: idle sway, louder when a fight is on
export const cheer = (t, seed, fighting) => (fighting ? 0.55 + 0.45 * Math.abs(Math.sin(t * (6 + seed * 3) + seed * 20)) : 0.12 * Math.abs(Math.sin(t * (1.6 + seed) + seed * 9)));
