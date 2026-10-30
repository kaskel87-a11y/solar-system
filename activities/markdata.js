// Vale's mark: data + pure helpers (no three.js, so node unit tests can import it). Runtime: activities/mark.js
export const REVEAL_M = 60, TIP_S = 40, REACH_M = 2.5, WALK = 1.5, DWELL_S = 10;
// colony-relative (AJ) metres; checked open ground in Olympus Row (tests/test-depth-unit.mjs + tests/test-depth.js)
export const MARK = {
  id: 'vale-mark-kessa', name: 'Kessa Vane', district: 'mars-downtown', area: 'Olympus Row',
  // [x, z, dwell s]: noodle bar -> plaza -> precinct steps and back; via points have no dwell (clear straight walks, probed in WebKit)
  spots: [[32, -404, 10], [8, -386, 0], [-4, -398, 8], [-22, -440, 10], [-4, -398, 0], [8, -386, 0]],
  text: '◆ Find Kessa Vane, a bail skipper in an orange coat ➤ she drifts between the noodle bar and the precinct steps in Olympus Row',
  tip: 'Vale: Kessa just bought noodles on my tab. She\'s on your map now. Go say hi.',
};

// pure: where the mark is t seconds into her loop (walk WALK m/s between spots, wait each spot's dwell)
export function markPos(t, spots = MARK.spots) {
  const legs = spots.map((a, i) => { const b = spots[(i + 1) % spots.length]; return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
  const dw = p => p[2] ?? DWELL_S, cycle = legs.reduce((s, l) => s + dw(l.a) + l.len / WALK, 0);
  let u = ((t % cycle) + cycle) % cycle;
  for (const l of legs) {
    if (u < dw(l.a)) return { x: l.a[0], z: l.a[1], moving: false };
    u -= dw(l.a); const w = l.len / WALK;
    if (u < w) { const k = u / w; return { x: l.a[0] + (l.b[0] - l.a[0]) * k, z: l.a[1] + (l.b[1] - l.a[1]) * k, moving: true, yaw: Math.atan2(l.b[0] - l.a[0], l.b[1] - l.a[1]) }; }
    u -= w;
  }
  return { x: spots[0][0], z: spots[0][1], moving: false };
}
// pure: should the marker show?
export const revealed = (dist, searchS, tipped) => tipped || dist <= REVEAL_M || searchS >= TIP_S;

