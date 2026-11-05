// v7.5.28 "cops calm down": pure ColSec heat rules shared by world.js, mars/pursuit.js, mars/crane.js and mars/raccoonrover.js.
// Taking a car is not a police matter by default: the owner shouts / runs, nobody calls it in. Only a ColSec officer (or
// a guard) standing within THEFT_COP_R metres with a clear line of sight can pin 1 star on you, and boosting a marked
// ColSec cruiser still counts (2 stars, like ramming one). Minor crimes on top of existing heat escalate at half speed;
// serious ones (shooting cops, killing, heists, dealing in view) escalate exactly as before. 1 star is a light nuisance:
// one slow drone, no pursuit rovers, no traffic cruisers joining in, a longer grab before a bust, and it cools off fast.
export const THEFT_COP_R = 12;                       // m: an officer this close, with line of sight, sees you take a car
export const POLICE_THEFT_STARS = 2;                 // stealing a marked ColSec vehicle
export const MINOR_STRIKES = 2;                      // minor crimes needed per extra star once you already have heat
export const MINOR_RE = /hit-and-run|speeding|vandal|tagging|discharging|impound fee|stole a|carjack|magnet-jack|called it in|pickpocket|raccoon theft/i;

// heat for taking / entering a vehicle. Returns the minimum star level to apply through crime() (0 = no crime at all).
export function theftStars({ police = false, copDist = Infinity, copLOS = false, wanted = 0 } = {}) {
  if (police) return POLICE_THEFT_STARS;
  if (copLOS && copDist < THEFT_COP_R) return (wanted | 0) < 1 ? 1 : 0; // 1 star if you were clean; never stacks
  return 0;
}
// is a reason a minor crime (escalates at half speed once you already have stars)?
export const isMinor = (min, why) => (min | 0) <= 1 && MINOR_RE.test(String(why || ''));
// crime(min, why) escalation: wanted 0 -> min; a hotter crime jumps straight to it; serious crimes +1 as before;
// minor crimes on top of heat need MINOR_STRIKES in a row (strikes reset when the heat clears)
export function escalate(wanted, min, why, strikes = 0) {
  wanted |= 0; min = Math.max(0, Math.min(5, min | 0)); strikes |= 0;
  if (min <= 0) return { to: wanted, strikes };
  if (wanted <= 0) return { to: min, strikes: 0 };
  if (min > wanted) return { to: min, strikes: 0 };
  if (!isMinor(min, why)) return { to: Math.min(5, wanted + 1), strikes: 0 };
  strikes++; if (strikes >= MINOR_STRIKES) return { to: Math.min(5, wanted + 1), strikes: 0 };
  return { to: wanted, strikes };
}
// seconds out of reach before the stars drop (was 5 + 2.5 per star: 7.5 s at 1★ .. 17.5 s at 5★)
export const evadeNeed = wanted => 4 + 2 * Math.max(1, wanted | 0);
// out of their sight at low heat cools you off even inside the colony (old rule needed 95 m + 90 m from a hub)
export const lowHeatCools = (wanted, nearest) => (wanted | 0) <= 2 && nearest > ((wanted | 0) <= 1 ? 45 : 60);
// seconds of hands-on before a bust (1★: longer grab, it's a nuisance not a takedown)
export const bustNeed = (wanted, driving) => (wanted | 0) <= 1 ? (driving ? 5 : 3.5) : (driving ? 3 : 2);
// highway ColSec cruisers only peel off to chase you from 2★
export const trafficCopsJoin = wanted => (wanted | 0) >= 2;
// 1★ drone flies slower (m/s) than a real chase
export const droneSpeed = wanted => (wanted | 0) <= 1 ? 17 : 26;
// pursuit.js pursuit rovers per tier (1★: none)
export const pursuitRovers = (stars, mobile) => stars <= 1 ? 0 : mobile ? 1 : 2;
// pursuit.js search countdown once they lose sight (was 8 + 5 per star)
export const searchSecs = stars => 6 + 4 * Math.max(0, stars | 0);
