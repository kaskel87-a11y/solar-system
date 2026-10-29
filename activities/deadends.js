// Dead-end guards for runner side jobs (see tests/test-deadends-unit.mjs).
// - collect steps with `spread_from` pools never got positions (items at NaN) -> one goto per pool spot.
// - race steps with `pts_local` were dropped -> resolve to district coords.
// - step markers that sit inside a building are pushed to the nearest free spot (city quests already get this).

export function prepTemplate(def, tpl, centre) {
  const L = def?.loop || {}, c = centre || [0, 0], out = [];
  const abs = p => [c[0] + p[0], c[1] + p[1]];
  for (const s of tpl || []) {
    if (s.type === 'collect' && s.spread_from && !s.at) {
      const pool = L[s.spread_from] || L[`${s.spread_from}_local`];
      if (Array.isArray(pool) && pool.length) {
        const n = Math.max(1, Math.min(s.n ?? L.n ?? L.n_shots ?? pool.length, pool.length));
        for (let i = 0; i < n; i++) out.push({ type: 'goto', at: abs(pool[i]), r: 4, item: s.item, text: `${s.text} (${i + 1}/${n})` });
        continue;
      }
    }
    if (s.type === 'race' && !s.pts) {
      const pl = s.pts_local || L.pts_local;
      if (Array.isArray(pl) && pl.length) { out.push({ ...s, pts: pl.map(abs) }); continue; }
    }
    out.push(s);
  }
  return out;
}

// AJ-frame step coords -> nearest spot outside geometry (via the ctx colony transform)
export function nudgeSteps(steps, ctx) {
  const toW = ctx?.colonyAt || ctx?.world?.colonyAt, free = ctx?.freeSpot || ctx?.world?.freeSpot;
  if (!toW || !free) return steps;
  const fix = at => {
    const w = toW(at); if (!w || !Number.isFinite(w.x)) return at;
    const f = free(w.x, w.z, 1.2); if (!f) return at;
    return [at[0] + (f.x - w.x), at[1] + (f.z - w.z)];
  };
  for (const s of steps) {
    if (Array.isArray(s.at) && s.type !== 'defeat') s.at = fix(s.at);
    if (s.type === 'race' && Array.isArray(s.pts)) s.pts = s.pts.map(fix);
  }
  return steps;
}

// Pit: what to do after a bout ends (world.lastDuel.why)
export function duelOutcome(L) {
  if (!L) return null;
  if (L.win || L.why === 'ko-win' || L.why === 'yield-win') return 'win';
  if (L.why === 'chicken') return 'rearm'; // they bottled it; wager refunded, find another fighter
  if (L.why === 'abandon') return null;
  return 'fail'; // ko-lose, yield-lose, forfeit (walked out of the ring)
}
