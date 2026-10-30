// Fast travel on Mars (Pumpkin): pure logic, no DOM. Used by mars/fasttravel.js, unit-tested in tests/test-fasttravel-unit.mjs.
export const FEE = 25;            // cr per hop (cheap), free to your own base
export const NEAR_M = 30;         // closer than this: you're already there
export const MATCH_M = 15;        // a map marker this close to a known place counts as that place
export const TAP_PX = 10;         // a real tap moves less than this between pointerdown and pointerup (same pointerId)
export const FADE_MS = 260;       // fade to black, hop, hold, fade back
export const HOLD_FRAMES = 3;     // at least this many frames kept black after the hop while the new chunks build (hides the hitch)
export const SETTLE_MAX_MS = 1500; // ...and up to this long, until the frame times settle (see settled())

// known places, in the order the map lists them
export const KINDS = {
  base: { icon: '🏠', name: 'Your base' },
  farm: { icon: '🌱', name: 'Dustbowl Homestead' },
  post: { icon: '👽', name: 'Xen-7 Trading Post' },
  spaceport: { icon: '🚀', name: 'Spaceport' },
  downtown: { icon: '🏙️', name: 'Downtown' },
  rough: { icon: '🔧', name: 'Rough neighborhood' },
  gated: { icon: '🏰', name: 'Gated community' },
  pit: { icon: '🥊', name: 'The Pit' },
  club: { icon: '🍸', name: "Danny's club" },
  turf: { icon: '🏴', name: 'Your turf' }
};
export const ORDER = Object.keys(KINDS);

export const fin = v => typeof v === 'number' && Number.isFinite(v);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const feeFor = p => (p && p.kind === 'base' ? 0 : FEE);

// raw: [{ kind, id?, name?, sub?, x, z }] from the live game (feature-detected sources). Drops bad / duplicate entries,
// fills icon + name, sorts by ORDER. Returns [{ id, kind, icon, name, sub, x, z, fee }].
export function normPlaces(raw) {
  const out = [], seen = new Set();
  for (const r of raw || []) {
    if (!r || !KINDS[r.kind] || !fin(r.x) || !fin(r.z)) continue;
    const id = String(r.id || r.kind); if (seen.has(id)) continue; seen.add(id);
    const k = KINDS[r.kind];
    out.push({ id, kind: r.kind, icon: r.icon || k.icon, name: r.name || k.name, sub: r.sub || '', x: r.x, z: r.z, fee: feeFor(r) });
  }
  return out.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

// the known place a map tap means: an ft: marker by id, else the nearest place within MATCH_M
export function matchPlace(p, places) {
  if (!p || !places?.length) return null;
  if (p.ft) { const q = places.find(x => x.id === p.ft); if (q) return q; }
  if (!fin(p.x) || !fin(p.z)) return null;
  let best = null, bd = MATCH_M;
  for (const q of places) { const d = dist(p, q); if (d < bd) { bd = d; best = q; } }
  return best;
}

// why you can't go, in plain words (null = you can). ctx: { onMars, flying, indoors, wanted, smuggling, heist, race, mission,
// job, turf, beltway, busy, credits, here:{x,z}, place }
export function blockReason(c) {
  if (!c || !c.onMars) return 'Fast travel only works on Mars.';
  if (c.flying) return 'Land first.';
  if (c.busy) return 'Not right now.';
  if (c.wanted > 0) return "You're wanted. Lose the cops first.";
  if (c.smuggling) return "You're on a smuggling run. Finish it or dump the cargo first.";
  if (c.heist) return "You're in the middle of a heist. Finish it first.";
  if (c.race) return "You're in a race. Finish it or quit first.";
  if (c.turf) return "There's a turf war on. Win it first.";
  if (c.beltway) return "You're on a Beltway job. Finish it first.";
  if (c.job) return "You're on a job. Finish it or quit first.";
  if (c.mission) return "You're on a mission. Finish it or quit first.";
  if (c.place && c.here && dist(c.here, c.place) < NEAR_M) return "You're already here.";
  const fee = feeFor(c.place);
  if (fee > 0 && !(c.credits >= fee)) return `You need ${fee} cr. You have ${Math.max(0, Math.floor(c.credits || 0))} cr.`;
  return null;
}

// a real tap: same finger, moved under TAP_PX (largest distance seen during the gesture, so a swipe that comes back still counts as a swipe)
export function isRealTap(down, up, maxMove = 0, px = TAP_PX) {
  if (!down || !up || down.id !== up.id) return false;
  const d = Math.max(maxMove || 0, Math.hypot(up.x - down.x, up.y - down.y));
  return d < px;
}

// frame-time stats for the arrival report: worst frame and the 95th percentile, ms
export function frameStats(dts) {
  const a = (dts || []).filter(fin).slice().sort((x, y) => x - y);
  if (!a.length) return { n: 0, max: 0, p95: 0, avg: 0, over50: 0 };
  const sum = a.reduce((s, v) => s + v, 0);
  return { n: a.length, max: Math.round(a[a.length - 1] * 10) / 10, p95: Math.round(a[Math.min(a.length - 1, Math.floor(a.length * 0.95))] * 10) / 10, avg: Math.round(sum / a.length * 10) / 10, over50: a.filter(v => v > 50).length };
}

// after the hop, stay black until the last HOLD_FRAMES frames are all smooth: under max(50 ms, 1.5x the p95 from before the hop)
export function settled(after, before) {
  const a = (after || []).filter(fin); if (a.length < HOLD_FRAMES) return false;
  const lim = Math.max(50, 1.5 * (frameStats(before).p95 || 0));
  return a.slice(-HOLD_FRAMES).every(v => v < lim);
}
