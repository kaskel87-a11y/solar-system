// Vale's mark: data + pure helpers (no three.js, so node unit tests can import it). Runtime: activities/mark.js
export const REVEAL_M = 60, TIP_S = 40, REACH_M = 2.5, WALK = 1.5, DWELL_S = 10;
// colony-relative (AJ) metres; checked open ground in Olympus Row (tests/test-mark-unit.mjs + test-depth.js)
export const MARK = {
  id: 'vale-mark-kessa', name: 'Kessa Vane', district: 'mars-downtown', area: 'Olympus Row',
  spots: [[26, -398], [-8, -452], [-32, -398]],
  text: '◆ Find Kessa Vane, a bail skipper in an orange coat ➤ she drifts between the noodle bar, the south plaza and the precinct steps in Olympus Row',
  tip: 'Vale: Kessa just bought noodles on my tab. She\'s on your map now. Go say hi.',
};

// pure: where the mark is t seconds into her loop (walk WALK m/s between spots, wait DWELL_S at each)
export function markPos(t, spots = MARK.spots) {
  const legs = spots.map((a, i) => { const b = spots[(i + 1) % spots.length]; return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
  const cycle = legs.reduce((s, l) => s + DWELL_S + l.len / WALK, 0);
  let u = ((t % cycle) + cycle) % cycle;
  for (const l of legs) {
    if (u < DWELL_S) return { x: l.a[0], z: l.a[1], moving: false };
    u -= DWELL_S; const w = l.len / WALK;
    if (u < w) { const k = u / w; return { x: l.a[0] + (l.b[0] - l.a[0]) * k, z: l.a[1] + (l.b[1] - l.a[1]) * k, moving: true, yaw: Math.atan2(l.b[0] - l.a[0], l.b[1] - l.a[1]) }; }
    u -= w;
  }
  return { x: spots[0][0], z: spots[0][1], moving: false };
}
// pure: should the marker show?
export const revealed = (dist, searchS, tipped) => tipped || dist <= REVEAL_M || searchS >= TIP_S;

