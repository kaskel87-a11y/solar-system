// ragsrover.js: does the player have a rover in Rags to Riches? (live fix v7.5.4)
// Before: only Wrench's beater (rags.js buyRover) set S.hasRover, so a player who'd bought rides at the 🚗 Dealer got
// thrown out of their own rover. Now ANY ride you own counts: Wrench's beater, or a non-stock entry in the garage save
// (progress.garage.rides, written by dealership.js buy/grantVehicle; the My rides parked-rides store uses the same list).
// Pure functions, no DOM; rags.js calls sync() when its save loads and on each tick.

export const NO_ROVER_MSG = 'This rover isn\u2019t yours yet. Buy one at the \uD83D\uDE97 Dealer, or steal a car off the street.';
export const PANEL_HINT = 'Or buy any ride at the \uD83D\uDE97 Dealer. Until then you walk, or steal a car off the street.';

// the garage rides list from the game progress, falling back to SSX.garage.rides (feature-detected)
export function ridesOf(progress, ssx) {
  try { const r = progress?.garage?.rides; if (Array.isArray(r)) return r; } catch {}
  try { const r = ssx?.garage?.rides; if (Array.isArray(r)) return r; } catch {}
  return [];
}
// every garage has the free 'stock' rover; anything else is a ride you bought or were given
export const ownsRide = rides => Array.isArray(rides) && rides.some(r => r && typeof r === 'object' && r.id != null && String(r.id) !== 'stock');
export const hasRover = (S, rides) => !!S?.hasRover || ownsRide(rides);
// should the rover kick you out? (only your own starter rover, only while you own nothing)
export const shouldKick = (S, rides, inOwnRover) => !!inOwnRover && !hasRover(S, rides);
// migrate: an old save (or a ride bought mid-run) that owns a ride gets hasRover = true. Returns true when it changed S.
export function sync(S, rides) {
  if (!S || S.hasRover || !ownsRide(rides)) return false;
  S.hasRover = true; return true;
}
