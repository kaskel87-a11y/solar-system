// Cop-kill pay (v7.5.87). Stars count as lifetime xp (ranks and the Star Shop).
// About 2⭐ for a light unit, more for heavier ones. A chase caps the stars so respawning
// cops can't be farmed; the cap resets when the wanted level clears. Foot officers still
// pay the flat 500 cr bounty from v7.5.12. No-cops zones pay nothing and add no heat.
export const COP_CASH = 500;
export const CHASE_CAP = 12;
export const TIER = Object.freeze({
  drone: 2, cruiser: 2, buggy: 2, guard: 2,
  officer: 3,
  heavy: 4, rover: 4,
  gunship: 5, swat: 5
});
export const starsFor = kind => TIER[kind] || 2;
export const isCop = s => !!s && s.foot === true;
export const footCash = kind => (kind === 'officer' || kind === 'heavy' ? COP_CASH : 0);

// earned = stars already paid this chase. zone = inside a no-cops area (the gulch).
export function takeKill(earned, kind, { zone = false } = {}) {
  const have = Math.max(0, earned | 0);
  if (zone) return { stars: 0, cr: 0, earned: have, capped: false, zone: true };
  const want = starsFor(kind);
  const stars = Math.max(0, Math.min(want, CHASE_CAP - have));
  return { stars, cr: footCash(kind), earned: have + stars, capped: stars < want, zone: false };
}
export function bountyFor(s) {
  if (!isCop(s)) return null;
  const k = takeKill(0, s.kind || 'officer');
  return { cr: k.cr, stars: k.stars };
}
export function bountyText(b, wanted = 0) {
  if (!b) return '';
  const bits = [];
  if (b.stars > 0) bits.push(`+${b.stars}⭐`);
  if (b.cr > 0) bits.push(`+${b.cr} cr`);
  const w = Math.max(0, Math.min(5, wanted | 0));
  if (w) bits.push(`Wanted ${'★'.repeat(w)}`);
  return bits.join(' · ');
}
