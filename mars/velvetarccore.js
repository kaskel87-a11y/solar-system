// Velvet expansion: pure rules for Ines's arc "House Always Wins" and for owning the Velvet Airlock (no DOM, no THREE;
// unit-tested by tests/test-velvetarc-unit.mjs). The runtime is mars/velvetarc.js.
// Naming (Chief of Staff's doc vs the game): the game never gives Ines a surname, so she is just "Ines". The doc's absentee
// owner of record, Marcus Thorne, is kept: no other owner exists in the game, and "Old Thorne" is already canon as Cassius
// Thorne's father in storymars2.js. His accountant is Grisby, the driver Pell, the Pit loan shark Vik Dorran.
export const KEY = 'ssx.velvetarc.v1';
export const UNLOCK = { bottles: 10, stars: 3000 };
export const TAKE = { pct: 0.08, perDay: 400, crPerStar: 10, cap: 20000 }; // the till never holds more than 20k (a 2-week absence)
export const PERKS = { showMult: 0.75, upstairsFree: true };
export const SWIPE = { seconds: 15, cycle: 9, look: 3.2, range: 1.6 }; // Grisby checks his slate 3.2 s of every 9 s
export const PIT = { wins: 2, bouts: 3 };
export const BOSS = { hp: 160, phases: [0.66, 0.33] };
export const CHASE = { close: 9, hold: 3 };

export function fresh() {
  return { v: 1, owned: false, ownedAt: 0, ending: null, till: 0, frac: 0, days: 0, lastHour: null, collected: 0, takeTotal: 0,
    safe: {}, ledgerGone: false, paidSable: false, pitWins: 0, pitLosses: 0, hinted: false };
}
export function load(raw) {
  let s = null; try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { s = null; }
  const f = fresh(); if (!s || typeof s !== 'object' || s.v !== 1) return f;
  const out = { ...f, ...s };
  out.owned = !!out.owned; out.till = Math.max(0, Math.min(TAKE.cap, +out.till || 0)); out.frac = Math.max(0, +out.frac || 0);
  out.safe = {}; for (const [k, q] of Object.entries(s.safe || {})) { const n = Math.floor(+q || 0); if (n > 0) out.safe[k] = n; }
  out.pitWins = Math.max(0, out.pitWins | 0); out.pitLosses = Math.max(0, out.pitLosses | 0);
  return out;
}
export const unlocked = (bottles, stars) => (bottles | 0) >= UNLOCK.bottles || (+stars || 0) >= UNLOCK.stars;
export const unlockHint = (bottles, stars) => `Ines talks business after 10 bottles sold to her (${Math.min(bottles | 0, UNLOCK.bottles)}/10) or ${UNLOCK.stars.toLocaleString('en-US')}\u2605 (${Math.floor(+stars || 0).toLocaleString('en-US')}).`;

// 8% of every wager made at the club's games while you own it; whole credits go to the till, the remainder carries over
export function addTake(s, wager) {
  if (!s.owned || !(wager > 0)) return 0;
  const raw = wager * TAKE.pct + s.frac, whole = Math.floor(raw); s.frac = raw - whole;
  const add = Math.min(whole, TAKE.cap - s.till); s.till += Math.max(0, add); s.takeTotal += whole; return whole;
}
// game days: count each time the Mars clock wraps past midnight (hour goes from >= 20 to < 4)
export function tickHour(s, hour) {
  if (!(hour >= 0 && hour < 24)) return 0; const prev = s.lastHour; s.lastHour = hour;
  if (!s.owned || prev === null || prev === undefined) return 0;
  if (prev >= 20 && hour < 4) { s.days++; s.till = Math.min(TAKE.cap, s.till + TAKE.perDay); return 1; }
  return 0;
}
export function collect(s) {
  const cr = Math.floor(s.till); if (!s.owned || cr <= 0) return { cr: 0, stars: 0 };
  s.till -= cr; s.collected += cr; return { cr, stars: Math.floor(cr / TAKE.crPerStar) };
}
// office safe: unlimited, item ids are whatever SSX.contraband uses
export function safeIn(s, item, qty) { const n = Math.floor(qty); if (!item || !(n > 0)) return 0; s.safe[item] = (s.safe[item] || 0) + n; return n; }
export function safeOut(s, item, qty = Infinity) { const have = s.safe[item] || 0, n = Math.min(have, Math.floor(qty)); if (!(n > 0)) return 0; if (have - n > 0) s.safe[item] = have - n; else delete s.safe[item]; return n; }
export const safeTotal = s => Object.values(s.safe).reduce((a, b) => a + b, 0);

// mission 2: Grisby's look cycle (deterministic in time) and the swipe meter. Progress only while you're at the slate and
// he isn't looking, or a waitress is between you; caught = meter resets and a warning.
export const grisbyLooking = t => ((t % SWIPE.cycle) + SWIPE.cycle) % SWIPE.cycle < SWIPE.look;
export function swipeTick(m, dt, { atSlate, looking, screened }) {
  if (!atSlate) return { ...m, state: 'away' };
  if (looking && !screened) return { p: 0, caught: (m.caught || 0) + (m.p > 0 ? 1 : 0), state: m.p > 0 ? 'caught' : 'wait' };
  const p = Math.min(SWIPE.seconds, (m.p || 0) + dt); return { ...m, p, state: p >= SWIPE.seconds ? 'done' : 'working' };
}
// mission 4: best 2 of 3 at the Pit
export function pitResult(s, win) { if (win) s.pitWins++; else s.pitLosses++; return s.pitWins >= PIT.wins ? 'won' : s.pitLosses > PIT.bouts - PIT.wins ? 'lost' : 'next'; }
// mission 5: Thorne's suit phases by hp fraction (1 = fresh)
export const bossPhase = frac => frac > BOSS.phases[0] ? 1 : frac > BOSS.phases[1] ? 2 : 3;
// mission 3: the arsonist's rover stops once you've stayed within CHASE.close m for CHASE.hold s
export function chaseTick(c, dt, d) { const t = d <= CHASE.close ? (c.t || 0) + dt : Math.max(0, (c.t || 0) - dt * 0.5); return { t, stopped: t >= CHASE.hold }; }

export function own(s, ending, now = Date.now()) { s.owned = true; s.ownedAt = now; s.ending = ending || s.ending || 'signed'; s.lastHour = null; return s; }
export const showPrice = (base, owned) => owned ? Math.round(base * PERKS.showMult) : base;

export const MANAGER_BARKS = [
  'Your house, your rules, boss.', 'Till\u2019s fat tonight. Office is where you left it.', 'Grisby\u2019s cooking honest books now. He hates it.',
  'Tiny asked if you want a raise for him. I said no for you.', 'Sable says the girls like the new owner. Don\u2019t let it go to your head.',
  'ColSec drove past twice. Didn\u2019t stop. That\u2019s what owning the right paper does.', 'Pour yourself one. On the house. Which is yours.'
];
