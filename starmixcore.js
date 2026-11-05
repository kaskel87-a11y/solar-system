// starmixcore.js (v7.5.46, Collin: "the better cars I get earns more stars; heists and businesses pay stars and cr")
// Pure rules + one tiny grant helper. Stars = the HUD ⭐ = game.progress.xp (lifetime; mars/starshopcore.js tracks spent).
// - ride bonus: stars you earn while driving get +0% (stock rover) .. +100% (a 12.5k cr ride or pricier), from the ride's PRICE,
//   so any vehicle added later (registerVehicle with a price, or a dealer listing) slots in on its own. No price -> estimated from vmax.
// - flex: cruising a +55% or better ride trickles 1 ⭐ every 30 s (at +55%) .. 15 s (at +100%), max FLEX.capPerHour.
// - heists: a successful score pays stars on top of its cr, scaled with the score size (loot credits).
// - Empire fronts: collecting the till pays 1 ⭐ per FRONT_CR cr collected.
export const RIDE = { base: 600, top: 12500, max: 100 };          // price at +0% / price at +max%
export const FLEX = { minPct: 55, slowS: 30, fastS: 15, minSpeed: 9, capPerHour: 100 };
export const FRONT_CR = 10;
export const MAX_DELTA = 2000;                                      // bigger single jumps (save import, cheats) never get a ride bonus

export function estPrice(spec) { const v = +spec?.vmax || 0; return v > 0 ? Math.round(RIDE.base + Math.max(0, v - 17) * 350) : RIDE.base; }
// price of a ride: explicit listing price > spec.price > spec.dealer.price > estimate from speed. Stock rover = RIDE.base.
export function ridePrice(kind, spec, listing) {
  if (!kind || kind === 'rover') return RIDE.base;
  const p = +(listing ?? spec?.price ?? (spec?.dealer && spec.dealer.price));
  return Number.isFinite(p) && p > 0 ? p : estPrice(spec);
}
export function bonusPct(price) {
  const p = +price || 0; if (p <= RIDE.base) return 0;
  const f = Math.min(1, Math.sqrt((p - RIDE.base) / (RIDE.top - RIDE.base)));
  return Math.min(RIDE.max, Math.round(f * RIDE.max / 5) * 5);
}
// extra stars for `base` earned at `pct`; fractional remainder carried in acc ({ r })
export function rideExtra(base, pct, acc = { r: 0 }) {
  if (!(base > 0) || !(pct > 0)) return 0; const x = base * pct / 100 + (acc.r || 0), n = Math.floor(x + 1e-9); acc.r = Math.max(0, x - n); return n;
}
export function flexEvery(pct) { if (!(pct >= FLEX.minPct)) return 0; const f = Math.min(1, (pct - FLEX.minPct) / (RIDE.max - FLEX.minPct)); return FLEX.slowS - f * (FLEX.slowS - FLEX.fastS); }
export function heistStars(lootCredits) { const c = Math.max(0, +lootCredits || 0); return Math.round((60 + 8 * Math.sqrt(c)) / 5) * 5; }
export function frontStars(cr) { return Math.max(0, Math.floor((+cr || 0) / FRONT_CR)); }

// add stars without the ride bonus counting them again (ridestars.js subtracts globalThis.__ssxStarSkip from what it sees)
export function grantStars(game, n) {
  n = Math.floor(+n || 0); const P = game?.progress; if (!P || !(n > 0)) return 0;
  globalThis.__ssxStarSkip = (+globalThis.__ssxStarSkip || 0) + n;
  if (typeof game.reward === 'function') game.reward(n, 0); else { P.xp = (+P.xp || 0) + n; try { game.save?.(); } catch (e) { /* */ } } // reward() also fires rank-ups
  return n;
}
